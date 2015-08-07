---
layout: post
title:  "Columnarization in Rust"
date:   2014-12-15 17:00:00
categories: columnarization serialization rust
published: true
---

So like everyone without a job, I've started to learn [Rust](http://www.rust-lang.org). And like everyone who has started to learn Rust, I now feel it is very important to tell you about my experience with it.

The project I'll talk about is for **columnarization**, a technique from the database community for laying out structured records in a format that is more convenient for serialization than the records themselves. This is important if you want to send data around in binary format at high throughputs, which is indeed something I often enjoy.

The rough idea is that, starting from a vector of some type, or `Vec<T>` in Rust, we want to repeatedly reduce the complexity of the type `T`, at the cost of increasing the number of vectors we have on hand. There are roughly three types of rules we'll follow:

1.  `Vec<uint>` A vector of base types is our base case. Do nothing.

2.  `Vec<(S, T)>` A vector of pairs is transformed to a pair of vectors: `(Vec<S>, Vec<T>)`.

3.  `Vec<Vec<T>>` A vector of vectors goes to a pair `(Vec<uint>, Vec<T>)`, corresponding to the original vector lengths, and their concatenated payloads.

These three rules, and generalizations thereof, allow us to transform vectors of fairly complex types into a sequence of vectors of simple types. These vectors of simple types are then very easy to serialize and deserialize, simply casting typed vectors to and from byte vectors.

## Implementation ##

I've gone and tried this out in Rust. Naturally, I won't share the first few evolutions with you, because you might conclude that neither Rust nor Frank is much of anything you'd want to be associated with. However, the current state of the project really appeals to me, and shows off some things I don't think I could easily do in most other languages I am familiar with.

For the curious, the repository can be cloned from [https://github.com/frankmcsherry/columnar](https://github.com/frankmcsherry/columnar).

The trait ("interface") I've implemented is `ColumnarVec<T>`, whose role in life is to `push` and `pop` records, much like a `Vec<T>` in Rust. That is to say, it accepts records and adds them to its columnar stash, and it can return those records when asked. This isn't yet much more interesting than `Vec<T>`, so the `ColumnarVec<T>` also adds the ability to `encode` its contents into byte arrays, and `decode` from byte arrays populating its contents.

{% highlight rust %}
pub trait ColumnarVec<T>
{
    fn push(&mut self, T);
    fn pop(&mut self) -> Option<T>;

    fn encode(&mut self, &mut Vec<Vec<u8>>);
    fn decode(&mut self, &mut Vec<Vec<u8>>);
}
{% endhighlight %}

The intended use of a `ColumnarVec` is to repeatedly call `push` with your favorite records, decide that you'd like to `encode` them to binary, ship the resulting arrays to a dear friend, who is then able to `decode` into her empty `ColumnarVec` and read the contents out using `pop`.

### uints, and basic types ###

For basic types, we have a very basic implementation of `ColumnarVec<T>`: we just use a `Vec<T>`. When records are pushed or popped, we simply use the underlying methods on `Vec`.

To `encode` we swap in an empty vector at `*self` (using `mem::swap`, which takes two mutable references), cast the swapped out vector to a `Vec<u8>`, and push it on to the `Vec<Vec<u8>>` stack.

To `decode` we pop a byte vector from the stack, casting to a `Vec<T>`, and then assign it to `*self`. This overwrites anything currently in the `ColumnarVec`, which ... perhaps is not expected behavior.

### Pairs, tuples, and structs ###

Pairs are a bit more interesting than base types, in that we want to destructure the pair into its component elements so that they can each be pushed into their corresponding vectors. More generally, we will only assume that the two types in the pair have implementations of `ColumnarVec` supporting them.

In Rust, as well as other sophisticated languages, we can indicate that any pair of types implementing `ColumnarVec<T1>` and `ColumnarVec<T2>` do themselves implement `ColumnarVec<(T1, T2)>`. We simply name the types, state the constraints, and then provide the implementation:

{% highlight rust %}
impl<T1, R1, T2, R2> ColumnarVec<(T1, T2)> for (R1, R2)
where R1: ColumnarVec<T1>,
      R2: ColumnarVec<T2>,
{
    fn push(&mut self, (x, y): (T1, T2))
    {
        self.0.push(x);    // push into first ColumnarVec
        self.1.push(y);    // push into second ColumnarVec
    }

    fn pop(&mut self) -> Option<(T1, T2)>
    {
        self.0.pop().map(|x| (x, self.1.pop().unwrap()))
    }

    fn encode(&mut self, buffers: &mut Vec<Vec<u8>>)
    {
        self.0.encode(buffers);
        self.1.encode(buffers);
    }

    fn decode(&mut self, buffers: &mut Vec<Vec<u8>>)
    {
        self.1.decode(buffers);
        self.0.decode(buffers);
    }
}
{% endhighlight %}

One appealing part of Rust, and several other similar languages, is that one can specify an implementation in a fairly light-weight manner. Here, I've not even defined a new type to support the methods, I've just indicate that they exist for a family of pairs of two types.

### Vectors and collections ###

Vectors, and variable sized fields like `Option<T>`, are where things start to get a bit sticky with columnarization. This is not only where we need to do some non-trivial re-shaping of the data, but also where we need to start dealing with dynamically allocated memory ourselves: people calling `pop` are going to want to see some vectors in their results.

One of the very appealing parts of Rust is its notion of ownership of data, and this is indicated obliquely in the signature of the `push` method. Whereas the `ColumnarVec` itself is passed in as a reference (the `&mut self` oddness), the record of type `T` is unadorned, meaning it is the actual record and we own it now. Owning the record is great, because it means no one else owns it, and if we want to rip it in to small pieces in the name of columnarization, we are free to do so.

A second appealing part of owning the record is that it means we also own all of the dynamically allocated memory the record owns, for example any `Vec` fields we might find. Obviously they hold valuable data we want to columnarize, but once that is done and the data are moved out, we can simply snag the `Vec` and hold on to it for future use. Future use such as needing a `Vec` when someone calls `pop`. By stashing the vectors we can avoid much interaction with the allocator when repeatedly encoding and decoding, and that means performance.

Let's look at the `push` and `pop` methods for the implementation of `ColumnarVec<Vec<T>>`. The first performs the possibly unsurprising tasks of pushing the input vector's length into a `ColumnarVec<uint>` and pushing its contents into a `ColumnarVec<T>`. Once done with the vector's contents, it stashes the empty-but-allocated vector, which is the part that I thought was really clever. The `pop` method runs in the opposite direction, fetching a stashed vector (or allocating if one doesn't exist), reading the intended length, and then filling the vectors contents before returning the vector.

{% highlight rust %}
impl<T, R1, R2> ColumnarVec<Vec<T>> for (R1, R2, Vec<Vec<T>>)
where R1: ColumnarVec<uint>,
      R2: ColumnarVec<T>,
{
    fn push(&mut self, mut vector: Vec<T>)
    {
        self.0.push(vector.len());
        while let Some(record) = vector.pop() { self.1.push(record); }
        self.2.push(vector);       // once empty, stash the vector
    }

    fn pop(&mut self) -> Option<Vec<T>>
    {
        if let Some(len) = self.0.pop()
        {
            // fetch or allocate a vector, then fill and return.
            let mut vector = self.2.pop().unwrap_or(Vec::new());
            for _ in range(0, len) { vector.push(self.1.pop().unwrap()); }
            Some(vector)
        }
        else { None }
    }

    // ... encode and decode call the corresponding methods on R1 and R2 ...
}
{% endhighlight %}

This approach to vector columnarization steers us clear of the traditional hazards of memory allocation inside what is meant to be a tight loop. In applications where one is repeatedly encoding, exchanging, and decoding data, in steady state the program will not need to allocate any new memory, which is an excellent position to be in.

## Performance ##

Measuring the performance of columnarization in Rust turned out to be harder than I expected. Mostly, coming from a managed JIT background, one could reasonably believe that only effect of an optimizing compiler was to randomize line numbers. Rust and LLVM are a fair bit smarter and without the right test harness they wil just optimize away your program.

The harness is in [example.rs](https://github.com/frankmcsherry/columnar/blob/master/examples/example.rs), and tests out columnar encoding and decoding of a few different datatypes. Be warned that these numbers are likely optimistic, as fewer optimizations will apply in the wild.

1.  Serializing `uint` data goes very fast, because it is just copying data and casting a pointer, if that.

    `Encoding/decoding at 11.24GB/s`

2.  Serializing `(uint, (uint, uint))` data goes less fast, but still quite fast:

    `Encoding/decoding at 5.29GB/s`

3.  Serializing `Vec<Vec<uint>>` data goes slower, due to conditional logic in the loop, but is still fast.

    `Encoding/decoding at 2.26GB/s`

These throughputs numbers will obviously vary as the shape of the data change. Currently, working with `Option<T>` types is slowest, due to the large ratio of conditional logic to actual bytes moved.

These are great numbers by my experience, and for about 150 lines of code all written in the base language (rather than code-gened nonsense), I am delighted.
