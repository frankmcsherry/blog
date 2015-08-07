---
layout: post
title:  "Columnarization in Rust, part 2"
date:   2014-12-16 17:00:00
categories: columnarization serialization rust
published: true
---

In a previous post, I introduced some work I was doing on columnarization for Rust. It's obviously very neat, so you should go and have a read; the rest of this post won't make all that much sense without it. I'm a little worried that it will be plenty confusing even with that background. :D

Recall the trait `ColumnarVec`, used to stash values and then to encode them into binary when asked. It looks like:

{% highlight rust %}
pub trait ColumnarVec<T> : Default
{
    fn push(&mut self, T);
    fn pop(&mut self) -> Option<T>;

    fn encode(&mut self, &mut Vec<Vec<u8>>);
    fn decode(&mut self, &mut Vec<Vec<u8>>);
}
{% endhighlight %}

I described a few implementations of the `ColumnarVec` trait for different types `T`, including `uint` and `(T1, T2)`. Why those two, do you ask?

I thought I would generalize the implementation of `ColumnarVec<uint>` to apply for any type `T:Copy`, which is to say those types whose binary representation are a full and faithful realization of the data. They are essentially the base types for which I'm able to cast a `Vec<T>` to a `Vec<u8>`.

I put together a general implementation, which (you guessed it) we're about to see. Here it is:

{% highlight rust %}
impl<T:Copy> ColumnarVec<T> for Vec<T>
{
    fn push(&mut self, data: T) { self.push(data); }

    fn pop(&mut self) -> Option<T> { self.pop() }

    fn encode(&mut self, buffers: &mut Vec<Vec<u8>>)
    {
        buffers.push(unsafe { to_bytes_vec(replace(self, Vec::new())) });
    }

    fn decode(&mut self, buffers: &mut Vec<Vec<u8>>)
    {
        *self = unsafe { to_typed_vec(buffers.pop().unwrap()) };
    }
}
{% endhighlight %}

Both `push` and `pop` are pretty simple, and `encode` and `decode` are where the business happens.

Actually, if you reflect back on the previous post, you might notice that there wasn't any evident encoding or decoding business; the implementations presented there only passed on calls to other `encode` and `decode` methods. Here we see what happens. Madness, to my object-orientated brain.

I asked a few people, and apparently it is just me who has my mind blown at the idea of assigning to `*self` in a method. I don't even think that is a thing in C#. But we certainly are doing it here, baby! The `replace` method swaps a new vector in to `self` and returns what used to be there, which we unsafely cast (code omitted due to shame, public health) to a `Vec<u8>`.

## Trouble back at the ranch

This all works, as far as I can see. Everything checks out, except...  back in `main.rs` there is trouble.

Up until this point, there was a unique implementation of `ColumnarVec<T>` for each type `T`. This meant that Rust had no problem finding an implementation when I just told it the type `T`. Now we have two implementations for `(uint, uint)`: the implementation we discussed last time based on its pair nature, and a new implementation because `(uint, uint)` implements `Copy`.*

Now, this is not necessarily a huge problem. We have an abundance of implementations, and if you show up with a `Vec<(uint, uint)>` we'll know what to do, and if you show up with a `(Vec<uint>, Vec<uint>)` we'll also know what to do. It's only a problem because we had previously exploited type inference to magic up the type in the first place, so we never even had to mention either of these types. Now we might be stuck asking the user to write down some disasterously complicated type for their columnarizer, because we can't figure out which one they want.

*: Technically `Copy` is a "kind", not a trait. I don't really know what this means.

## Frank invents an [anti]pattern

Given that I'm new to this fancy-language scene, I thought I'd make up a neat way to indicate a default `ColumnarVec` implementator for each type `T`. This would allow us to keep both implementations for `(uint, uint)`, and other copyable types. So I added the trait

{% highlight rust %}
pub trait Columnar<R: ColumnarVec<Self>> { }
{% endhighlight %}

All this trait means is that something implementing it, say a type `T`, identifies a type `R` it likes which implements `ColumnarVec<T>`. It says `Self` up there, but that is the placeholder for the type's name.

Now we just go and implement `Columnar` for as many types as we would like, for example:

`impl Columnar<Vec<u8>> for u8 { }`

This just says that `u8` is a type that would prefer to use `Vec<u8>` as its default imlementation of `ColumnarVec<u8>`. Pretty good choice. The other examples are pretty simple too, but they start repurposing `T` and `R` to mean other things, and no one is happy.

When it comes time to construct a specific `ColumnarVec`, we can rely on the uniqueness of a type `R` satisfying both of the constraints `T: Columnar<R>` *and* `R: ColumnarVec<T>`. Let's see it in action:

{% highlight rust %}
fn one_off<T, R>(data: Vec<T>) -> Vec<Vec<u8>>
where T: Columnar<R>,
      R: ColumnarVec<T>
{
    let mut col_vec: R = Default::default();
    while let Some(record) = data.pop()
    {
        col_vec.push(record);
    }

    let mut output = Default::default();
    return col_vec.encode(&mut output);
}
{% endhighlight %}

We've imposed some constraints on the types `T` and `R`. The type `T` is given to us by the input data, but we are free to find any `R` satisfying the constraints. As discussed, we've ensured there is but one.

Now that we are talking about one specific type, we'll just ask for a default instance of it, in the line

{% highlight rust %}
let mut col_vec: R = Default::default();
{% endhighlight %}

We indicate the type with `: R`, even though we don't really know what `R` will be. We then use the magic of the `Default` trait whose implementors all provide a static `default()` method returning a valid default instance of the type. You'll notice (only now) that the definition of `ColumnarVec` above requires `Default`. It is new as of this post. Don't look at the previous post, it is previous for a reason.

Fortunately, the defaults for pairs and vectors and such are all totally sane (empty vectors). Rust insists on RAII (resource acquisition is initialization), which means that you never get your hands on invalid or uninitialized data. No funny constructors to call; the `ColumnarVec` is good to go. And go it does!

Notice that I've also used `default` to get an initialized `Vec<Vec<u8>>`, only I didn't have to put in the type because there is only one type that `encode` accepts!

## Shameless plug

Because I'm sure this is going to be the Next Big Thing, I packaged what exists of columnarization in a Rust crate, and stashed it on [crates.io](http://crates.io). So if you are using Rust (you are at the end of a second blog post about using Rust, so let's say "yes"), you can include it in your project by adding

`columnar="0.0.4"`

to the `[depedencies]` section of your `Cargo.toml` file. I'd love any feedback you have!
