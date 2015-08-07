---
layout: post
title:  "Data-parallelism in timely dataflow"
date:   2015-04-19 15:20:00
categories: dataflow relational join
published: true
---

The [previous post](http://www.frankmcsherry.org/dataflow/relational/join/2015/04/11/genericjoin.html) described a neat algorithm of [Ngo et al](http://arxiv.org/abs/1310.3314) and then described how one could go and implement this in [timely dataflow](https://github.com/frankmcsherry/timely-dataflow). There were several bits of Rust code, a few places where details were glossed over, and then the claim that this was now a data-parallel implementation of the neat algorithm.

In this post we walk through how the data-parallel bit happens, and detail some of the moving parts.

Let's start at the top, with some code we didn't see in the previous post: a `main` method:

{% highlight rust %}
fn main() {
    let workers = 4; // whatever you like here!
    let mut guards = Vec::new();
    for communicator in ProcessCommunicator::new_vector(workers) {
        guards.push(thread::Builder::new()
                        .name(format!("worker thread {}", communicator.index()))
                        .scoped(move || triangles(communicator))
                        .unwrap());
    }
}
{% endhighlight %}

Here we identify some desired number of workers, ask `ProcessCommunicator` (whoever that is) to create a new vector (of something), and for each element of this vector we start up a thread. Now, the elements of that vector have been suggestively named `communicator`, and indeed they each implementation a `Communicator` trait. The `scoped` method is where the thread is started, and as you can see the only input it takes is one of these communicators. What could they possibly do?

## Communicator

The `Communicator` trait provides the *only* point of contact between workers in timely dataflow. It has a fairly simple definition, so let's look at it:

{% highlight rust %}
pub trait Communicator {
    fn index(&self) -> u64;
    fn peers(&self) -> u64;
    fn new_channel<T:Send+Columnar+Any>(&mut self)
        -> (Vec<Box<Pushable<T>>>, Box<Pullable<T>>);
}
{% endhighlight %}

The only functionality a communicator exposes to workers is to tell them their identity, the number of other workers, and to set up channels with the other workers. The `new_channel` method returns some targets the worker can push typed data at (one per worker) and one source the worker can pull from.

When a worker pulls from a source they receive data pushed by other workers into their corresponding targets. The workers are expected to create the same sequence of channels; things go sideways if not.


That's all. If workers want to communicate in any other ways, they'll need to create some channels.

## Using communicators

Let's look at the last bit of code from the previous post, the `triangles` method referenced just above, in which we define the dataflow computation and set it going. I'm going to base this off of the code as it currently exists in [the repository](https://github.com/frankmcsherry/dataflow_join), which has a few syntactic differences from the previous post.

{% highlight rust %}
fn triangles<C: Communicator>(communicator: C) {

    // load up our fragment of the graph
    let graph = Rc::new(RefCell::new( /* load up mmap'd file */ ));

    // define extenders for a -> b and  (a, b) -> c, respectively
    let b_extend = vec![&graph.extend_using(|| { |&a| a as u64 } )];
    let c_extend = vec![&graph.extend_using(|| { |&(a,_)| a as u64 }),
                        &graph.extend_using(|| { |&(_,b)| b as u64 })]

    // create a new root dataflow context
    let mut root = GraphRoot::new(communicator);
    let mut input = {
        let mut builder = root.new_subgraph();
        let (input, stream) = builder.new_input();

        // enable, extend, extend
        stream.enable(builder)
              .extend(b_extend)
              .extend(c_extend);

        input  // return the input handle
    };

    // iterate until done
    while root.step() {
        // introduce input
    }
}
{% endhighlight %}
Perhaps the most important thing to observe about this method is that it is *per-communicator* logic. Each worker will call this method independently, and so they need to make sure they act in concert. This mostly boils down to constructing channels in some consistent order, and not going off and doing something else while other workers are waiting for you.

Ideally the code isn't too threatening.  The first few lines are related to the previous post, where we load up some graphs and define "prefix extenders" used to drive the aforementioned neat algorithm.

There are some very important lines, though, so let's look a bit more carefully at them.

## Creating a dataflow graph root

The point at which the dataflow graph first comes in to existence is when we wrap up our trusty communicator in a `GraphRoot`. This is that momentous line of code:

{% highlight rust %}
let mut root = GraphRoot::new(communicator);
{% endhighlight %}

A `GraphRoot` is pretty simple, actually. It is the simplest implementator of the `GraphBuilder` trait, whose main role in life is to hand back references to a `Communicator` so that we can make channels.

There are much more advanced and interesting, implementors of `GraphBuilder`. Let's see one now!

## Creating a dataflow subgraph

The next fragment of code creates a dataflow subgraph.

{% highlight rust %}
let mut subgraph = root.new_subgraph();
{% endhighlight %}

The `new_subgraph()` method, defined by the `GraphBuilder` trait, returns a `SubgraphBuilder`.
This is that advanced and interesting implementor of `GraphBuilder` I mentioned above.

The `SubgraphBuilder` provides access to a `Communicator` and the ability to call `new_subgraph`, but it also has a non-trivial implementation of the method `add_scope<S: Scope>(scope: S)`.

Of course, I'm sure you all remember what a [`Scope`](http://www.frankmcsherry.org/dataflow/naiad/2014/12/29/TD_time_summaries.html) is, right? ($$ \leftarrow $$ click! do it. omg... click! click!).

### A refresher on Scopes

The `Scope` trait defines the methods different components of a timely dataflow graph need to use to discuss the progress of execution in the graph. A scope can explain to its parent how many inputs and outputs it has, what sorts of messages it might plan to send on those outputs, and given the chance maybe do a little bit of work to make progress itself, which it can then report to its parent.

There are more details in [the link above](http://www.frankmcsherry.org/dataflow/naiad/2014/12/29/TD_time_summaries.html), and much more to say about the progress tracking protocol.

Our first example of a scope is actually in the very next line of code:
{% highlight rust %}
let (input, stream) = subgraph.new_input();
{% endhighlight %}

The `input` method is provided by an extension trait on implementors of `GraphBuilder`. Let's see it.

{% highlight rust %}
pub trait InputExtensionTrait<G: GraphBuilder> {
    fn new_input<D:Data>(&mut self) -> (InputHelper<G::Timestamp, D>,
                                        Stream<G::Timestamp, D>);
}
{% endhighlight %}
Ok, that might have been too much information. We see that `new_input` does return two things, and apparently these are an `InputHelper` and `Stream`, but what these are is presently a total mystery. Also, what does all that `G::Timestamp` noise mean?

Last things first, `G::Timestamp` is an *associated type* of the graph builder `G`. Each graph builder has an associated timestamp, and all scopes that graph builder will tolerate must use that timestamp. Both `InputHelper` and `Stream` are defined in terms of a specific common timestamp, given by `G`. They each also have a second type parameter, `D`, which is the type of data the input will pass along.

The [implementation](https://github.com/frankmcsherry/timely-dataflow/blob/master/src/example_static/input.rs) of `input` is neither particularly self-explanatory or illuminating, so I'll summarize. The method does a few things, including creating an `InputHelper` (to push data at) and a `Stream` (to connect dataflow to). Importantly, it also creates an `InputScope`, which implements `Scope` and is what makes promises about which input timestamps are sealed. It is added to the subgraph builder.

The implementation of `input` also snags a channel from the communicator, and wires it up so that submitted data get routed directly to consumers of `Stream`. Other than keeping track of the number of records sent, which `InputScope` needs, all of the logic lives behind the channel implementations.

## Intermission: data-parallelism

Let's take a moment to reflect on where we are. We've defined some infrastructure that will let each worker send records in to a dataflow computation, and, if we keep it up, exchange these records with other workers. Although a lot of our discussion here sounds like we are just talking about a single thread of execution, *that is exactly how we want it*.

One of the main virtues of data-parallel programming is that we get to define our computation as if it were single threaded, knowing that if we spin up an arbitrary number of copies of the workers, and exchange data between them in an appropriate manner, the same result comes out the other end.

This programming pattern does come with restrictions, mainly that all communication must be explicit and that the structure of communication (the dataflow graph itself) is defined ahead of time, but subject to these restrictions we don't have to think too hard about concurrency. That is really good news.

## Adding some more scopes

Let's get back to work. Our worker must define what it should do with this input stream now that it has it.

At this point we get in to a slightly mysterious detail of our current implementation, which connects to Rust's seriousness about shared access to mutable state. Rust is really quite serious about this topic.

The graph builder `builder` owns a bunch of mutable state, and we need to be very clear about when we are using it and when we are not using it. We we explicitly asked `builder` to create an input for us, which is pretty clear. At the same time, we'd probably rather not involve a reference to `builder` in each method call, but we must know who is currently responsible for it.

What we have at the moment is a notion of an `ActiveStream`, which is the information about a stream (basically a name and a listener list one can join) plus a graph builder. The `ActiveStream` *owns* that graph builder, in the Rust sense, so it knows that it has exclusive mutable access to its services.

We create active streams from inactive streams by calling `enable` with a graph builder argument.

{% highlight rust %}
stream.enable(builder)
      .extend(b_extend)
      .extend(c_extend);
{% endhighlight %}

You might look at this and say: "whoa, is `builder` gone now?" In this case, yes. However, you can always get it back from an active stream; we just happened to discard the results in this case.

Additionally, and this was someone else's clever idea, not mine: there is a blanket implementation
{% highlight rust %}
impl<G: GraphBuilder> GraphBuilder for &mut G {
    // lots of "fn func(&mut self) { (**self).func() }"
}
{% endhighlight %}
which says we can use a mutable reference `&mut G` anywhere we would use a `G: GraphBuilder`. So we could have replaced `builder` up there with `&mut builder`, and not risked losing track of it.

## Actually adding more scopes

Writing `extend` a few times is sort of a cop-out as an example of additional scopes. Not so helpful.

In [the previous post](http://www.frankmcsherry.org/dataflow/relational/join/2015/04/11/genericjoin.html) I elided the implementation of `StreamPrefixExtender`, the trait providing actions on `ActiveStream` including things like counting the number of extensions, proposing extensions, and validating the extensions. Let's go through one of these implementations.

I'm going to use `propose` as the simplest implementation. The other two are roughly the same, but with slightly more inner logic. The `propose` implementation uses an extension method `unary` that I've written, wrapping the implementation of a scope with one input and one output. We will move to its implementation in just a moment, but let's see its arguments to understand what it needs to know.

{% highlight rust %}
impl<P, E, G, PE> StreamPrefixExtender<G, P, E> for Rc<RefCell<PE>>
where P: Data+Columnar,
      E: Data+Columnar,
      G: GraphBuilder,
      PE: PrefixExtender<P, E>+'static {
    fn propose(&self, stream: ActiveStream<G, P>) -> ActiveStream<G, (P, Vec<E>)> {
        let clone = self.clone();
        let exch = Exchange::new(|x| hash(x)); // <-- minor lie
        stream.unary(exch, format!("Propose"), move |handle| {
            let extender = clone.borrow();
            while let Some((time, data)) = handle.input.pull() {
                let mut session = handle.output.session(&time);
                for datum in data {  // send each extension
                    session.give(p, extender.propose(&p));
                }
            }
        })
    }
{% endhighlight %}

The `unary` method takes three arguments: a description of how its inputs need to be exchanged (to make sure the data arrive at the right worker), a `String` naming the operator, and logic that takes a `handle` through which inputs can be read and outputs sent.

If we think for a moment, there really isn't all that much more that needs to be said about an operator:*

1. Which records should go to which worker.
2. What should the worker do with the inputs when they arrive.

In the example above, we just want to consistently route prefixes to the same worker, so we use a hash of the prefix. When presented with some prefixes, the right thing to do is extend each of them and send the pair of prefix and extensions. Nothing else to say about the logic here, really.

\*: Actually there is more to know about, namely **notification**, which is a *hugely* important part of timely dataflow, but we just haven't gotten there yet. Subsequent post, for sure.

## Unary scope

The `unary` method hides a lot of boiler plate, so that we can focus on the dataflow operator logic.

What actually goes on inside that method? Nothing wildly complicated. It is [about 90 lines of code](https://github.com/frankmcsherry/timely-dataflow/blob/master/src/example_static/unary.rs#L81-L174). When `unary` is called it uses the first argument, `exch` above, to transform a channel from the communicator into a simple push/pull interface. It registers the "push" part of this with `stream` and attaches the "pull" part to its `handle` object. It also prepares an `ActiveStream` for output, and connects the output of `handle` to the (to be populated) list of interested listeners. Finally, it creates a `UnaryScope` who owns `handle` and will both call the user logic on it when needed, and report the number of records received and sent to its parent scope.

That was a pretty long paragraph, so maybe it isn't all that simple. But, it isn't wildly complicated either.

## Setting things in motion

The final bit of code looks like this:

{% highlight rust %}
while root.step() {
    // introduce input
}
{% endhighlight %}

That looks pretty simple and harmless, but it is what sets the whole dataflow computation into motion.

The `root.step()` call recursively traverses the scopes, asking each about any progress they've made. This is where each scope looks around, says "hey I *do* have input!", does a little bit of work, and then tells its parent what its done. The return value indicates whether there remains more work to do.

In our case, the scopes will start moving input records, and start proposing extensions, and doing all the bits of logic we've programmed in. They will keep going as long as the inputs remain open, the operators report they are not yet done, and the [progress tracking protocol](http://www.frankmcsherry.org/dataflow/naiad/2014/12/29/TD_time_summaries.html) reports unresolved work.

Crucially, all this business is written so that each of these workers operates independent of the others. While they do coordinate implicitly through data exchange and the progress tracking protocol, we just need to turn each of them on and run each of them until it stops.

Ideally this stopping happens sooner with more workers, but... well I don't want to spoil the surprise.
