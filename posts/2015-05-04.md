---
layout: post
title:  "Abomonation: terrifying serialization"
date:   2015-05-04 15:20:00
categories: serialization
published: true
---

Today we're going to look at a simple serialization library written in Rust. Simple and utterly terrifying.

The library, Abomonation (typo intentional), uses Rust's `unsafe` keyword in some interesting ways. The intent is that it is actually safe if you only deserialize binary data serialized by the library.

I should say that many of the things going on in here look a lot like what goes on in [CapnProto](https://capnproto.org). If you are serious about being a grown-up about things, I would absolutely look over there. Among other things, it has the advantage of not necessarily lowering your opinion of me, unlike this post.

## Serialization and Deserialization

Our goal is to write a pair of methods with the following signatures:

{% highlight rust %}
fn encode<T>(typed: &[T], bytes: &mut Vec<u8>);
fn decode<T>(bytes: &[u8]) -> &[T];
{% endhighlight %}

That is, if you present a slice of data `&[T]` we can populate a `Vec<u8>` with appropriate binary data. Similarly, if you provide us some binary data `&[u8]`, we can interpret it as typed data `&[T]` for you.

We aren't going to do this by the end of the post, but we'll have something pretty similar. These are the actual signatures at the moment (the implementations are at the end of the post; don't read them yet!):

{% highlight rust %}
fn encode<T: Abomonation>(typed: &Vec<T>, bytes: &mut Vec<u8>);
fn decode<T: Abomonation>(bytes: &mut [u8]) -> &Vec<T>;
{% endhighlight %}

There are important distinctions here, so let's briefly think about what's being said by the interfaces.

1. We are only going to be able to do this for **some** types `T`, those implementing `Abomonation`.
   This makes sense, because some types are hard to serialize. The name doesn't make sense. Yet.
2. We are taking a `&mut [u8]` rather than a `&[u8]`. That's weird. Why would we need exclusive access to the input data? Are we going to change the binary data we've received? (I'm so sorry.)
3. We are returning a reference to a `Vec<T>`. Where did that `Vec<T>` come from and who owns it?
   The `decode` function doesn't take one as a parameter, and you (usually) don't just get references to owned data out of nowhere.

Well isn't that just a big pile of mysterious language? Apparently we are going to do some things, and you should all be terrified.

## Encoding and Decoding nice data

Let's start with some easy examples, ones that use the `unsafe` keyword but which we'll pretty easily convince ourselves are really pretty friendly. We'll get to learn a bit about how Rust manages its data under the covers, and maybe get our feet wet. What could go wrong?

The following function takes a slice of typed data and presents it back as a slice of binary data.

{% highlight rust %}
unsafe fn typed_to_bytes<T>(slice: &[T]) -> &[u8] {
    std::slice::from_raw_parts(slice.as_ptr() as *const u8,
                               slice.len() * mem::size_of::<T>())
}
{% endhighlight %}

Notice the `unsafe` label on the function. This is because it uses the `from_raw_parts` method, which is itself unsafe (it doesn't check to make sure that the underlying data look correct). In this case it is safe, because we only want to look at the binary data (not mutate it) and every byte is a valid `u8`.

I could choose to remove the `unsafe` label and put unsafe interally like so, declaring the method safe:

{% highlight rust %}
fn typed_to_bytes<T>(slice: &[T]) -> &[u8] {
    unsafe {
        std::slice::from_raw_parts(slice.as_ptr() as *const u8,
                                   slice.len() * mem::size_of::<T>())
    }
}
{% endhighlight %}

I have been warned this is bad, though, because reading a struct-padding byte is undefined behavior. This will not be the most irresponsible thing that happens in this post.

On the other end of the safety spectrum, I present:
{% highlight rust %}
unsafe fn bytes_to_typed<T>(slice: &mut [u8]) -> &mut [T] {
    std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut T,
                                   slice.len() / mem::size_of::<T>())
}
{% endhighlight %}

This not only exposes mutable slices, but permits any type at all. Imagine what would happen if `T` was `String`, for example: `String` owns its `[u8]` buffer and cointains a pointer to it. You would be able to dereference arbitrary places in memory! Danger!! Danger!! The `unsafe` label stays on for this one.

Imagine you just saw `bytes_to_typed` eat a goat. It is powerful, but the `unsafe` fence protects us. Just like in that movie with all those cautionary tales that I didn't stay for the end of.

### You said "nice data"

These two methods work great if all you want to serialize are slices of primitive types. If you have a `&[u64]` you can just transmute it over to a `&[u8]` and write out the data. If you get a `&[u8]` back you can (in good conscience) know that transmuting it to `&[u64]` works well.

We are going to use the above two functions in our implementation of `encode` and `decode`, so let's be brave and add the following sorts of implementations:

{% highlight rust %}
impl Abomonation for u8 { }
impl Abomonation for u16 { }
impl Abomonation for u32 { }
impl Abomonation for u64 { }
// lots of others ...
{% endhighlight %}

Notice that these implementations don't *do* anything, they just indicate that it is safe for `encode` and `decode` to transmute them around. In fact, `Abomonation` will have a few methods, but these types can just use the default implementations.

## The Abomonation stirs ...

Primitive types are neat and all, but we are serious people! What about things like tuples? Surely I should be able to transmute a `&[(u64, i8)]` to binary and back, right? Yes, you should. But...

... it's complicated. You see, we built this trait to reach beyond primitive types. Much further beyond.

Ok, let's just write down this trait.

{% highlight rust %}
trait Abomonation {
    unsafe fn entomb(&self, _writer: &mut Vec<u8>) { }
    unsafe fn exhume(&mut self, _bytes: &mut &[u8]) { }
}
{% endhighlight %}

Wow, grim. In case `unsafe` wasn't enough, I chose creepy method names. Creepy, but appropriate!

The two methods have the following intents:

* `entomb`: having written `&self` as binary, serialize any further data it might own.

* `exhume`: having populated `&mut self` with binary data, deserialize data it owned.

The reason this trait exists is because our method `encode(&Vec<T>, &mut Vec<u8>)` is just going to copy the contents of the typed vector into the binary vector. Seems harmless enough for the types implementing `Abomonation` so far, but we will use `entomb` to check with each `T` to see if they want to write any more. Similarly, `decode` uses `exhume` on each element to recover any owned data.



Wait, owned data? What? I mean, `u64` doesn't own any data, so does it need to do anything? Nope!  
All those other primitive types don't need to either. They can use the default empty implementation.

All those happy townsfolk, oblivious to what awaits...

We got this far because we needed to talk about tuples. Let's see how we might implement the weirdly capable `Abomonation` for a pair of abomonable types.

{% highlight rust %}
impl<T1: Abomonation, T2: Abomonation> Abomonation for (T1, T2) {
    unsafe fn entomb(&self, writer: &mut Vec<u8>) {
        self.0.entomb(writer); self.1.entomb(writer);
    }
    unsafe fn exhume(&mut self, bytes: &mut &[u8]) {
        self.0.exhume(bytes); self.1.exhume(bytes)
    }
}
{% endhighlight %}

Really, the whole interface is probably just messsing with forces we don't understand.

For example, you probably don't understand why `exhume` uses a `&[u8]` when we said up above that we were going to use `&mut [u8]`. In retrospect, there were warning signs that something was wrong.

## Late in the lab one night ...

Some drinks in, an ambitious scientist finds she needs to serialize a `&[Vec<Vec<u64>>]`. She thinks:

> Hey, couldn't I implement `Abomonation` for `Vec<T>` where `T: Abomonation`?

Well, you can certainly type it.

{% highlight rust %}
impl<T> Abomonation for Vec<T> where T: Abomonation {
    unsafe fn entomb(&self, writer: &mut Vec<u8>) {
        // write out the contents of self
    }
    unsafe fn exhume(&mut self, bytes: &mut &[u8]) {
        // read back the contents into &mut self
    }
}
{% endhighlight %}

You know, this might just work. A `Vec` is a pointer, a length, and a capacity. Three `usize` values. Serializing this triple doesn't serialize the `Vec`'s *contents*, but we can just do that in `Vec`'s `entomb`. Similarly, when we pick up the serialized form of the `Vec`, a triple, it doesn't point at anything valid (to our great shame, it points at some location in memory wherever we serialized this), but  `exhume` gives us a chance to read valid data back and make things right.

If the scientist did something responsible in `exhume`, like create a new `Vec<T>` with new backing memory and assign it to `*self`, the story ends happily. But our story doesn't follow that path.

## Writing the code that shouldn't be written

The scientist, unfortunately, was mad with power. She demanded *zero* allocations. She would use the binary data *as provided* to back her creepy, hard-to-reason-about deserialization machinations.

Rust provides unsafe functions capable of assembling a `Vec` out of "raw parts": a pointer, a length, and a capacity. Our scientist is going to connect wires not meant to be connected, by building a `Vec` using a pointer into the supplied byte array.

Now, our scientist may be power-mad, but she is still a scientist so she's going to do this properly.

{% highlight rust %}
unsafe fn exhume(&mut self, bytes: &mut &[u8]) {

    // 1. extract the memory from bytes to back our vector
    let binary_len = self.len() * mem::size_of::<T>()
    let buffer = &bytes[..binary_len];
    *bytes = &bytes[binary_len..];

    // 2. transmute buffer to &mut [u8], and then to a &mut [T].
    let slice: &mut [T] = bytes_to_typed(mem::transmute(buffer));

    // 3. build a new vector using this memory
    let vector = Vec::from_raw_parts(slice.as_mut_ptr(), self.len(), self.len());

    // 4. overwrite *self w/o dropping it.
    std::ptr::write(self, vector);

    // 5. pretend everything is normal; call exhume on each element
    for element in self.iter_mut() { element.exhume(bytes); }
}
{% endhighlight %}

Pretty much all of these lines (everything except step `1.`) are unsafe. Because the method has the `unsafe` tag, we don't need to flag individual regions as unsafe. They are all *quite* unsafe.

Let's take a tranquil moment to reflect on what's been done, and what might happen. We've minted a `Vec<T>` pointing at memory that cannot be freed. The memory is valid, and the rest of the `Vec<T>` appears legitimate (length, capacity). But, as soon as we return from this method that `Vec<T>` is loose in the country-side and who knows what might happen.

Well, what could go wrong, really?

## GRAAAAAAAAARRRRR!!

You know, actually it all sort of works.

## GRAAAaaaoooo?

Yeah, there is a disasterous mess of things here, and really Rust's memory safety isn't touching any of this with a ten foot lifetime bound. But let's talk about the possible issues.

First, let's be clear that `exhume` is `unsafe`. Don't call it. I haven't figured out how to keep people from calling it yet (public traits export all their methods), but just don't. It makes a few assumptions about how it will be called. It assumes that:

1. The `&[u8]` data is, in fact, exclusively held. We go and transmute it to `&mut [u8]` which is very wrong unless we are sure that we have the only reference. Fortunately, `decode` takes a `&mut [u8]` as its argument, and this ensures that our references are exclusive. We are also careful to partition the `&[u8]` into disjoint parts when we use it, to maintain this invariant.

2. The `&mut self` parameter to `exhume` will only be presented outwards as a `&self`. We can't let anyone mutate or own this data. Trying to add elements to `Vec` will trigger a re-alloction, which would attempt to release the memory. It is very important that all references to the data are just that, only references. And references with lifetimes bounded by that of the source `&[u8]`.

3. The `&mut self` parameter to `exhume` will never be dropped. Dropping the `Vec` would attempt to release the backing memory, which ... well it isn't going to work out. Fortunately, there never was a `Vec`. There were some bytes, and we pretended that a reference to the bytes was actually a reference to a `Vec`, but there was never a `Vec` to drop.

There are probably some other assumptions. Everything breaks if you pass in invalid data, for example. Don't do that either.

In fact, sorting out whether these assumptions are properly nailed down, or whether something truly horrible has happened, is basically what I'm up to now. I don't really know, and it isn't particularly clear what I need to do to use `unsafe` correctly. I invite your thoughts and criticism.

Rust's position is, perhaps refreshingly honestly: "yeah, it's unsafe. you even said so."

## Epilogue

What about our ambitious, power-mad scientist; where did she get off to?

While we have been fretting about what might have gone wrong, she is experiencing excellent throughput numbers. Let's look at a few using Rust's benchmarking facilities.

### Encoding

Here is a helpful routine to spin Rust's `Bencher` struct on any type implementing `Abomonation`.

{% highlight rust %}
fn _bench_enc<T: Abomonation>(bencher: &mut Bencher, vector: &Vec<T>) {

    let mut bytes = Vec::new();
    encode(vector, &mut bytes);
    bencher.bytes = bytes.len() as u64;
    bencher.iter(|| {
        bytes.clear();
        encode(vector, &mut bytes);
    });
}
{% endhighlight %}

We try it out with types `Vec<u64>`, `Vec<String>`, and `Vec<Vec<(u64, String)>>` and see:

    test bench_enc_u64     ... bench:       411 ns/iter (+/- 84) = 19990 MB/s
    test bench_enc_string  ... bench:     12039 ns/iter (+/- 3330) = 2893 MB/s
    test bench_enc_vec_u_s ... bench:     12578 ns/iter (+/- 1665) = 3482 MB/s

The `String` is just `format!("grawwwwrr!")`. Results may vary with the string's length, silliness.

I should also point out that the throughput is not *goodput*. It includes the extra pointers and capacities and stuff we didn't need to send. The numbers do get a bit worse, especially for short strings. It's the sort of thing you could fix by having a buffer implement `encode`/`decode` and push/pull just lengths. However, you do need to stage the `Vec`s somewhere, and our approach let `bytes` do that for us.

### Decoding

What about deserialization? That is where all the mess is, right? Well, it is a bit hard to measure deserialization speed fairly, because we are really not doing much other than fixing up some pointers.

I did put some testing code in place to make sure that we were getting the right results back:

{% highlight rust %}
fn _bench_dec<T: Abomonation+Eq>(bencher: &mut Bencher, vector: &Vec<T>) {

    let mut bytes = Vec::new();
    encode(vector, &mut bytes);
    bencher.bytes = bytes.len() as u64;
    bencher.iter(|| {
        let result = decode::<T>(&mut bytes[..]);
        assert!(result.len() == vector.len());
        for i in 0..result.len() {
            assert!(result[i] == vector[i]);
        }
    });
}
{% endhighlight %}

These give pretty comparable results. Apparently pushing a bunch of bytes works at about the same rate as checking that those bytes are what you expected. Again, not goodput numbers; *caveat emptor*.

    test bench_dec_u64     ... bench:       525 ns/iter (+/- 262) = 15649 MB/s
    test bench_dec_string  ... bench:     11289 ns/iter (+/- 2432) = 3086 MB/s
    test bench_dec_vec_u_s ... bench:     12557 ns/iter (+/- 2183) = 3488 MB/s

Just to show how silly things are, here are the numbers where we comment out the assert loop, just checking the resulting lengths.

    test bench_dec_u64     ... bench:         2 ns/iter (+/- 0) = 4108000 MB/s
    test bench_dec_string  ... bench:      2625 ns/iter (+/- 1031) = 13272 MB/s
    test bench_dec_vec_u_s ... bench:      3020 ns/iter (+/- 1266) = 14503 MB/s

Hey look, 4TB/s deserialization. Maybe it is time to head back to Silicon Valley, maybe start things up.

## Appendix: encode and decode

I wanted to put the implementations up here, but they aren't very pretty. In particular, I suspect they could be greatly improved (possibly by deletion).

{% highlight rust %}
pub fn encode<T: Abomonation>(typed: &Vec<T>, bytes: &mut Vec<u8>) {
    let slice = unsafe { std::slice::from_raw_parts(mem::transmute(typed), size_of::<Vec<T>>()) };
    bytes.write_all(slice).unwrap();
    unsafe { typed.entomb(bytes); }
}
{% endhighlight %}

{% highlight rust %}
pub fn decode<T: Abomonation>(bytes: &mut [u8]) -> &Vec<T> {
    let (split1, split2) = bytes.split_at_mut(mem::size_of::<Vec<T>>());
    let result: &mut Vec<T> = unsafe { mem::transmute(split1.get_unchecked_mut(0)) };
    unsafe { result.exhume(&mut &*split2); }
    result
}
{% endhighlight %}

The whole pile of stuff will be up on [github](https://github.com/frankmcsherry) and [crates.io](https://crates.io) eventually, but I wanted to take at least a bit of time with other eyeballs on this to see if a) it is all horribly wrong, and b) whether the risk is ever worth it.

Also, I should obviously avoid serializing pointers to your memory locations. No one needs to see that.
