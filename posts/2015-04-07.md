---
layout: post
title:  "Differential dataflow"
date:   2015-04-07 14:00:00
categories: differential dataflow
published: true
---

I'm now in Berlin, working on [timely dataflow in Rust](https://github.com/frankmcsherry/timely-dataflow). It is up and running, multiple processes and all, so the next step is to get some experience using it to point out performance and usability issues. Unfortunately, at the moment there is a Rust internal compiler error preventing me from doing this, so I'm going to write a bit about some of the applications!

Differential dataflow is an approach to doing incremental data-parallel computation that several of us [introduced at CIDR 2013](http://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf). I'll work through the details, but the rough idea is rather than have a point in the computation (a dataflow vertex) maintain a dataset, it maintains a collection of differences from which the data can be efficiently updated. If this sounds a bit like incremental dataflow computation, it is, and differential dataflow can be viewed as a generalization of existing techniques from incremental dataflow computation to dataflow graphs with possibly nested iteration.

## Setting

Differential dataflow is primarily motivated by its ability to efficiently compute and update arbitrarily nested iterative data-parallel computations (things like MapReduce, but extended with an iteration operator). Each operator in a differential dataflow computation is defined much like a MapReduce stage, including:

* For each input `i` a key function `Key_i: Si -> K` from source records to a common key type.
* A reduction fuction `Reduce: (K, &[S0], &[S1], ... , &[Sk]) -> &[R]` from a key and some source records to some result records.

The output collection for any input collection is whatever results from grouping the source records by the key function, applying the reduction function, and merging the result records across all groups.

These operators are arranged in a graph, with outputs from one leading in to the inputs of others.

To this we add an iteration operator on collections, which takes an iteration function from collections to collections and a number of iterations. If we were to write this in Rust it might look like:

{% highlight rust %}
trait IterableExt {
    // returns something equivalent to iteration^steps(data)
    fn iterate<F: Fn(Self)->Self>(data: &Self, body: F, steps: u64) -> Self;
}
{% endhighlight %}

This iteration operator starts to make dataflow look like a pretty powerful computational framework, but implementing it efficiently raises all sorts of questions.

### Naive implementation

Clearly there are some ways we could implement `iterate` for a `Collection<S>`. We could just have a `for`-loop which does as many steps as requested:
{% highlight rust %}
impl<S> Iterable for Collection<S> {
    fn iterate<F: Fn(Self)->Self>(data: &Self, body: F, steps: u64) -> Self {
        let mut data = data;
        for _ in (0..steps) {
            data = body(data);
        }
        return data;
    }
}
{% endhighlight %}

This approach is possibly very wasteful, especially in a not-uncommon case where the collection stabilizes as it iterates, reaching a fixed point (where each application of `body` results in the same collection). We could put some logic in place checking each iteration to see if it has change and exiting early if it hasn't, but we may still be leaving a lot of performance on the table if *most* of the collection is not changing.

### Incremental dataflow

If we only want to do one `iterate` at a time ("obviously", you say; bear with me), a smarter approach is to frame the implementation in terms of incremental updates to the collections. Rather than fully form collections `data` each iteration, the operators could remember the previous values of `data` and we could instead determine and communicate only *changes* to `data`. If all operators are implemented this way, the entire computation can be in terms of these differences.

Incrementally updates are not only more efficient for communication, but in the data-parallel setting they can also dramatically improve performance. If I have a collection of one billion records, and I am presented with a single change: "add/remove `record`", I only need to apply the key function to `record` and incrementally update the *group* that `record` might belong to. Other groups have not changed, and our computational model requires their outputs be functions only of the inputs. The only possible change to the output is due to changes to the `key(record)` group.

### Limitations

One way to view incremental computation is that for a *sequence* of collections, it determines and communicates the differences between collections. There are several cases where this is a perfect fit, but also many where the requirement that the collections form a sequence is limiting.

Consider the problem of incrementally updating the input to an iterative computation. While the iterates of the iterative computation do form a sequence, we would now like to change the *first* element in that sequence. What incremental computation allows us to do is update the *final* element of the sequence. For some computations this may be correct, but for many computations it is simply incorrect to "patch" the output; it doesn't produce the right answer.

Consider a hypothetical case where a bank uses some fraud data and a set of financial transactions to expand its view of "risky customers" to those people connected to a fraudster through any number of financial transactions. Perhaps you are accidentally determined to have had fraudulent activity, leading to your associates being labeled as fraudsters too. While you might correct the data after talking with the bank, removing your name from the source fraud dataset, your associates are still labeled as fraudsters and in one iteration you will be again too. In fact, none of you should be labeled as such, but updates to the current state cannot fix that. We must "restart" the iterative computation with the change.

## Differential interpretation

Differential dataflow removes the restriction to sequences of collections by generalizing the notion of "differences between collections". Formally, it uses a technique called "[Moebius inversion](http://en.wikipedia.org/wiki/Möbius_inversion_formula)" to allow differencing along an arbitrary partial order (rather than just a sequence). Although this sounds very complicated, and the area is deep and interesting, our application of it really isn't so mysterious.

Imagine we have a set of collections `Collection[t]` indexed by some elements `t` of a set. If we avoid being too specific about this set, some examples become a bit easier to understand.

For our example of propagation of fraud data along edges in a financial transaction graph, the collection indicating who is or isn't risky could be indexed by the pair `(epoch, iteration)`, indicating the state of the collection using the `epoch` version of input fraud data, after `iteration` rounds of computation. The risk data are initially indexed by `(0,0)` and perhaps converge to their limit at `(0,1032)`. You place a phone call to the bank, who can then update the base fraud data with index `(1,0)` indicating new data and no iteration yet. This data can then lead to a revised output now indexed by `(1,937)` (as perhaps the number of rounds to converge has decreased without you in the input data).

Pedagogically, the collection at `(1,0)` is more similar to the collection at `(0,0)` than it is to the collection "just a moment ago" at `(0,1032)`. Rather than attempt to describe the collection at `(1,0)` in terms of the collection at `(0,1032)`, as incremental computation might, we will describe a more flexible differencing scheme that instead relates it to the collection at `(0,0)`.

More generally, we can describe the collection at `(1,i)` by the collections at `(0,i)` *and* `(1,i-1)`.

The indices we choose to use, and the partial order we define over them, will drive how the differencing is done. By choosing an ordering that better reflects the development and dependence of data we are able to have fewer and smaller differences. The fact that `(1,0)` and `(0,1032)` are not ordered using the standard partial order allows us to avoid using either as part of the definition of the other.

Using the product partial order (one pair is less-or-equal another if both coordinates are), we get a nice alignment with the actual dependencies in an iterative computation, where an iterate depends only on collections at prior iterations and prior epochs.

### Differential representation

Let's write down a fairly uncontroversial view of how we might represent collections `Collection[t]` as the accumulation of differences `Difference[t]` over a common ordered set of indices:

```
Collection[t] = sum_{s <= t} Difference[s]
```

This feels very safe and intuitive for a total order like the natural numbers: we add up the differences up to and including index `t`.

Nothing about this equation requires that the elements be *totally* ordered. We can just as easily use a partial order like `(u64, u64)`: pairs of numbers where one is less or equal another exactly when both coordinates are, just like in our `(epoch, iteration)` example above.

### Differential computation

Our intuition for computation may start to break down without a total order, raising the technical question of "how do we determine the values of `Difference[t]`?" A bit of mathematical re-arrangement takes the implicit definition of `Difference[t]` above to

```
Difference[t] = Collection[t] - sum_{s < t} Difference[s]
```

which indicates that we can derive differences from the collection at index `t` and all "earlier" differences. This adds a technical requirement that the partial order be "[well-founded](http://en.wikipedia.org/wiki/Well-founded_relation)", which informally means that we can always find something to start the differencing from. We will make this a lot easier by assuming that our computation is driven by a system (a timely dataflow system, perhaps!) presenting differences in an order so that for each `t` we have already determined and recorded `Difference[s]` for all `s < t`.

This may look very expensive, and of course if we had to compute `Difference[t]` for every `t` we would be pretty upset. Fortunately, as with incremental computation, when an operator is presented with new input differences, we can restrict the `t` for which it may possibly produce output differences. Further, our use of partial orders can yield substantially sparser differences, meaning less work to do.

Like in incremental dataflow, an differential dataflow operator only needs to update the output for keys associated with changed inputs. However, an update at an index `t` may require outputs at indices other than `t`, which is very much *un*-like incremental computation. For the moment, let's just say that we can compute these indices efficiently, and the number is often not particularly large.

## Implementation

Let's go through a simple implementation of a differentail dataflow operator (in Rust).

### Representing collections

The first thing to define is a differential representation of a collection. In our simple approach we will just store each `difference[t]` as a list of `(V, i64)` indicating the change to the count associated with each record. In fact, we'll just stash all of these in the same `Vec<(V, i64)>`, and use a second array to delineate which regions are associated with which indices, of index type `T`.

{% highlight rust %}
struct CollectionAsList<T, V> {
    updates: Vec<(V, i64)>,   // value and delta
    indices: Vec<(T, usize)>, // index and count
}
{% endhighlight %}

What do we need to be able to do with this representation? So far, I've been using traits for accessing the data as indexed collections or as indexed differences:

{% highlight rust %}
trait Collection<T, V> {
    fn setc(&mut self, index: T, data: &mut Vec<(V, i64)>);
    fn getc(&self, index: &T, data: &mut Vec<(V, i64)>);
}
{% endhighlight %}

Here the `setc` method takes an index and an intended collection, and inserts the correct differences at `index` to ensure that when accumulated the result is `data`. The `getc` method populates the supplied `Vec<(V, i64)>` with the accumulated differences, which by definition is the value of the collection at `index`.

{% highlight rust %}
trait Difference<T, V> {
    fn setd(&mut self, index: T, data: &mut Vec<(V, i64)>);
    fn getd(&self, index: &T) -> &[(V, i64)];
}
{% endhighlight %}

In the `Difference` trait, the `setd` method just internalizes the suppied vector of updates and the `getd` method just returns the slice corresponding to the requested index.

The method names have `c` and `d` suffixes so that I don't have to show you Rust's name resolution. It isn't that horrible, but it is distracting I'll probably just end up changing the traits anyhow.

In my implementation I'm currently using the constraint that `V: Ord`, meaning we can tell when two instances are the same (important for accumulating differences) and there is some ordering on them. This ordering property is less obviously necessary, but it does allow me to do merge-based accumulation, rather than faking out a hash table inside the arrays or something horrible like that.

### Representing computations

The next thing to consider is how an operator might be implemented. In the interest of manageable type signatures we will do a unary operator, from collections of `S` to collection of `R`, indexed by `T`.

For each key, we will need to keep track of the accepted source differences, and we will want to keep track of the produced result differences. We will use the following simple structure for per-key differential state:

{% highlight rust %}
pub struct DifferentialShard<S, R, T> {
    source: CollectionAsList<T, S>,
    result: CollectionAsList<T, R>,
}
{% endhighlight %}

Next we'll want to put these together as an operator, involving a key selection function, some logic to apply to transform source records to result records, and some storage to make it all stick together.

{% highlight rust %}
pub struct DifferentialOperator<K: Hash+Eq, S, R, T, L, KF> {
    key_fn: KF,
    logic:  L,
    shards: HashMap<K, DifferentialShard<S, R, T>>,
}
{% endhighlight %}

This isn't particularly instructive yet. Let's constrain the types and implement some methods.

{% highlight rust %}
impl<K, S, R, T, L, KF> DifferentialOperator<K, S, R, T, L, KF>
where K: Hash+Eq,
      S: Ord+Clone,
      R: Ord+Clone,
      T: PartialOrd+Clone,
      L: Fn(&K, &[(S,i64)], &mut Vec<(R,i64)>),
      KF: Fn(&S)->K {
  // .. rest of implementation broken out below ..
{% endhighlight %}

These constraints mean that our data `S` and `R` need to be totally ordered and clonable, and our index `T` needs to be partially ordered and clonable. We also have types `KF` and `L` corresponding to closures for our key function and operator logic. The key function must take a reference to a source record and produce a key, the operator logic must take a reference to a key, a reference to source data, and a populatable vector for result data. The logic is asked to work on pairs `(S,i64)` and `(R,i64)` in order to make my life easier, rather than `S` and `R` followed by accumulating the counts.

Next we write a method to accept new input data, not yet grouped by key, which does the partitioning of source records and loads each of the groups into the appropriate `DifferentialShard`.

{% highlight rust %}
fn accept_source(&mut self, index: T, data: Vec<(S, i64)>) {
    let mut stage = HashMap::new();
    for (record, delta) in data {
        let key = (self.key_fn)(&record);
        let mut list = match stage.entry(key) {
            Occupied(x) => x.into_mut(),
            Vacant(x)   => x.insert(Vec::new()),
        };
        list.push((record, delta));
    }
    for (key, mut list) in stage.drain() {
        let shard = match self.shards.entry(key) {
            Occupied(x) => x.into_mut(),
            Vacant(x)   => x.insert(DifferentialShard::new()),
        };
        list.sort(); // using orderedness to merge
        shard.source.setd(index.clone(), &mut list);
    }
}
{% endhighlight %}
In principle, we could be stashing the input records at the ends of `shard.source.updates` rather than staging them first, but we would need to tweak the interface a bit to expose more than just `setd`.

Finally, for now, we write a method to relate the source collection to result collection at a specific index, and to correct the result differences if they do not currently accumulate to the correct result collection.

{% highlight rust %}
fn update_result(&mut self, index: &T, output: &mut Vec<(R, i64)>) {
    let mut temp_src = Vec::new();
    let mut temp_dst = Vec::new();
    let logic = &self.logic;
    for (key, shard) in &mut self.shards {
        temp_src.clear(); temp_dst.clear();

        // fetch collection, run logic, compare
        shard.source.getc(index, &mut temp_src);
        if temp_src.len() > 0 {
            logic(key, &mut temp_src, &mut temp_dst);
        }
        shard.result.setc(index.clone(), &mut temp_dst);

        for result in shard.result.getd(time)  {
            output.push(result.clone());
        }
    }
}
{% endhighlight %}

The main possibly surprising part (the part I got wrong the first time) is that we only want to call the logic on non-empty `temp_src` collections. This is an important part of correctness, as everything goes horribly wrong if we let `logic` produce output on empty collections; we don't want to have to run it for all possible keys, but rather only the ones for which we've actually seen data.

## Trying it out!

Oh yeah! We wrote all that code, let's see what it does. Here is an operator which counts the number of distinct strings with each length, producing a weird `(String, usize)` result pair for each length.

{% highlight rust %}
fn main() {
    let mut vertex = DifferentialOperator::new(|x:&&str| x.len(), |k, s, t| {
        t.push(((format!("length: {:?}", k), s.len()), 1))
    });

    let mut result = Vec::new();
    let sched = vec![(Product::new(0,0), vec![("a", 1), ("b", 3), ("cc", 2)]),
                     (Product::new(0,1), vec![("a",-1), ("b",-3)]),
                     (Product::new(1,0), vec![("a",-1), ("b",-1)]),
                     (Product::new(1,1), vec![("a", 1), ("b", 2)])];

    for (index, differences) in sched {
        result.clear();
        vertex.accept_source(index.clone(), differences);
        vertex.update_result(&index, &mut result);
        println!("difference[{:?}] : {:?}", &index, result);
    }
}
{% endhighlight %}


Let's go through the produced output line by line:

First we see here the changes from the initially empty result collection to the output on the supplied source collection. We have two length-one strings and one length-two string:

```
difference[(0, 0)] : [(("length: 1", 2), 1), (("length: 2", 1), 1)]
```

Next we see what happens when we remove the length-one strings: we lose any record of "length: 1":

```
difference[(0, 1)] : [(("length: 1", 2), -1)]
```

The next change is in a different coordinate, and doesn't include the removal of the length-one strings that occurs at `(0, 1)`. Rather, it removes one of the two length-one strings and decrements the number of the other by one (though two occurences of "c" should still remain). The result is one distinct length-one string, and the way differential dataflow represents that is to subtract one record and add the other.

```
difference[(1, 0)] : [(("length: 1", 1), 1), (("length: 1", 2), -1)]
```

Although we might like to change the `2` to a `1` by directly subtracting one, those two values are now part of the data rather than the counts. If they had been formatted into the string instead, it would be clearer that this is not possible.

Finally, we add back an "a" (as otherwise the total would be negative) and leave ourselves with one "b". Index `(1,1)` has one length-one string, and so the output is naturally:

```
difference[(1, 1)] : [(("length: 1", 2), 1)]
```

Yeah, that last one isn't obvious at all, is it?

We would like the output to be `[(("length: 1", 1), 1), (("length: 2", 1), 1)]`, and the difference above is the right quantity to add in to make this be the case. We subtracted too many `[(("length: 1", 2), 1)]` records, at both `(0, 1)` and `(1, 0)`, and need to put one back.

## Things yet to do

The main issue that this example avoids is knowing on which indices to call `vertex.update_result`.

For example, even if we had not had any input differences at `(1, 1)`, which would be odd as the counts for both "a" and "b" would go negative, we would still need to call `update_result`. The input difference at `(1, 0)` introduces the need to at least check the output at `(1, 1)`.

If we just call `update_result` at `(1, 1)`, without adding source differences, we get the following:

```
difference[(1, 1)] : [(("length: 1", 1), -1), (("length: 1", 2), 2)]
```

Here we are told that we have too many reports of one length-one string, and need multiple reports of two length-one strings. This is because we were already short one such report, and there are now two length-one strings (though with negative counts; not something we paid attention to in our logic).

Roughly, `difference[t]` can lead to result differences at `t` joined (in the partial order sense of least upper bound) with the join of any subset of pre-existing indices with non-empty differences.

We should also be more careful about noting the subset of keys that need updating at a given index (we currently update  them all. Naughty!). This isn't much more complicated than maintaining a `HashMap<T, HashSet<K>>`, populated by the join logic described above.

None of this is too complicated to compute, but stitching it all together properly requires something like a timely dataflow system, where one can respond to source differences with a combination of result differences and notification requests (for checking possible result updates at future indices).

Ideally the Rust ICE blocking me wiring all this together gets sorted out promptly, otherwise I will be forced to delight you with a post about worst-case optimal join processing in timely dataflow.
