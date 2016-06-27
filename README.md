I am a researcher and computer scientist. I was once in San Francisco, but am now traveling.

The following posts are in reverse chronological order: newest posts are first. If you are keen to follow a lower-volume repo, the `squashed` branch gets squashed merges when new posts hit. They don't get any edits until the next merge, though, so come back here for the definitive versions of text (or if you want to submit a PR).

### Posts

---

#### [Differential Dataflog](https://github.com/frankmcsherry/blog/blob/master/posts/2016-06-21.md) 

Datalog is a pretty interesting language, something like a version of SQL with an iterative loop wrapped around the whole thing. It fits very nicely within [differential dataflow](https://github.com/frankmcsherry/differential-dataflow), which does all sorts of iterative data-parallel computations. In this post, we dive into some detail, and see that we can not only evaluate Datalog programs but interactively query their results.

---

#### [Statistical inference considered harmful](https://github.com/frankmcsherry/blog/blob/master/posts/2016-06-14.md)

A Usenix Security 2014 best paper, [Privacy in Pharmacogenetics: An End-to-End Case Study of Personalized Warfarin Dosing](https://www.usenix.org/system/files/conference/usenixsecurity14/sec14-paper-fredrikson-privacy.pdf) has some angsty experiences with differential privacy. It turns out, from my point of view at least, that they mostly have non-concerns and should enjoy life more. And maybe put fewer pictures of dead bodies and toe-tags in their talks.

---

#### [Differential privacy for dummies, redux](https://github.com/frankmcsherry/blog/blob/master/posts/2016-05-19.md)

Jane Bambauer and Krish Muralidhar [blogged](http://blogs.harvard.edu/infolaw/2016/05/17/diffensive-privacy/) about the reaction to their Fool's Gold article. In particular, [I have previously responded to it](https://github.com/frankmcsherry/blog/blob/master/posts/2016-02-03.md), and they respond to some of the issues raised there. I think they remain mostly wrong, and try to explain why in this response to their response to my response.

---

#### [Explaining outputs in modern computations](https://github.com/frankmcsherry/blog/blob/master/posts/2016-03-27.md) 

We look at techniques for automatically explaining individual outputs of a big data computation by using a small number of inputs. Want to know why two people are in the same connected component? How about the shortest path connecting them, answered and updated in realtime? 

---

#### [Differential privacy: an illustrated primer](https://github.com/frankmcsherry/blog/blob/master/posts/2016-02-06.md)

A hands-on introduction to differential privacy, meant to help out folks who aren't really sure where to start but don't want to stop at just counting things. 

---

#### [Differential privacy for dummies](https://github.com/frankmcsherry/blog/blob/master/posts/2016-02-03.md)

I'm back in Morocco, on my own time again, which means that I get to write whatever happens to be in my mind. Today, that was that lots of people critical of differential privacy seem to be pretty bad at ... math, writing, ... honesty. So, we have a walk-through of the sort of work that the non-technical fields publish about differential privacy, and how it has nearly no relation to reality.

---

#### [Graph processing in 2016](https://github.com/frankmcsherry/blog/blob/master/posts/2015-12-24.md)

In which I have a bunch of opinions about all the papers I had to read, review, and listen to in the past year, and what might be productive to do differently in the coming year. This is all a bunch of opinion, with a bit of technical detail hiding behind the blather.

---

#### [Progress tracking in Timely Dataflow](https://github.com/frankmcsherry/blog/blob/master/posts/2015-12-19.md)

Timely dataflow extends traditional distributed dataflow with a lightweight, asynchronous coordination mechanism: notifications. In this post we'll look in to how notifications, and progress tracking generally, work in the Rust version of timely dataflow. We'll recap a bit of what [Naiad](http://dl.acm.org/citation.cfm?id=2522738) did for progress tracking, and explain where and when we've gone in a different direction. Possibly why, if my typing is good.

---

#### [An introduction to Differential Dataflow, part 2](https://github.com/frankmcsherry/blog/blob/master/posts/2015-11-27.md)

Let's look a bit more at differential dataflow, and start to work through some of the details about how it works. Where does the magic come from? How does differential dataflow manage to efficiently update complex iterative dataflows without redoing all sorts of work? Where will you finally be able to apply your understanding of [Moebius inversion](https://en.wikipedia.org/wiki/Möbius_inversion_formula)? 

Learn how math actually makes computers go faster. 

---

#### [An introduction to Differential Dataflow, part 1](https://github.com/frankmcsherry/blog/blob/master/posts/2015-09-29.md)

We are going to take a diversion from the cold reality of timely dataflow, into the fantasy world of differential dataflow, a world of lollipops and laptops where all of your big data computations instantaneously update whenever your input data change. What wonders await us in this magical world of imagination?

---

#### [An introduction to Timely Dataflow in Rust, part 3](https://github.com/frankmcsherry/blog/blob/master/posts/2015-09-21.md)

In part 3 we are going to build a small program to do breadth-first search in a random graph! That is basically the most important thing ever. As a side-effect, we will also see a more realistic program, get some numbers, think about some optimizations, and then broaden our minds with a neat new algorithm that fits timely dataflow's features really well.

---

#### [An introduction to Timely Dataflow in Rust, part 2](https://github.com/frankmcsherry/blog/blob/master/posts/2015-09-18.md)

In part 2 of the introduction to timely dataflow in Rust, we look at how to write custom operators, and how to use notifications, one of timely dataflow's defining characteristics. We'll get familiar with the `unary_stream` and `unary_notify` operators, and position ourselves for some graph computation in the next post.

---

#### [An introduction to Timely Dataflow in Rust, part 1](https://github.com/frankmcsherry/blog/blob/master/posts/2015-09-14.md)

It's been a long time since I've said anything about timely dataflow in Rust, and I don't think I've ever said anything about how to get started with it. I'm going to try and fix that now, by walking through some relatively simple examples of timely dataflow programming. We'll see how to set up a streaming timely dataflow computation, an iterative computation, and a streaming-iterative computation.

That sound amazing, right? There is going to be more, soon!

---

#### [Epic Graph Battle of History: Chaos vs Order](https://github.com/frankmcsherry/blog/blob/master/posts/2015-08-20.md)

A reader wrote in about the "Sorting out graph processing" post, with some questions about how well sorting works when compared against the newest as-yet-unpublished (but SOSP 2015 bound!) systems research on how best to process graphs. I didn't know the answer, but I set out to discover it!

The perf numbers for the system itself are not yet in (my contact is PDT), but I'll update with them as they flow in.

**Update**: Numbers for PageRank on Chaos are in. Other numbers will have to wait until October, says author.

---

#### [Sorting out graph processing](https://github.com/frankmcsherry/blog/blob/master/posts/2015-08-15.md)

We revisit the conventional wisdom that sorting is expensive, and random access is fast. In particular, if you think you might need to do a bunch of random accesses, maybe you should consider sorting the requests first. We look at some results in a paper from SOSP 2013 and see how speedy sorting algorithms likely change the trade-offs the paper proposes.

Also, differential dataflow goes a lot faster as a result of this stuff, so you should read about it.

---

#### [The impact of fast networks on graph analytics, part 2.](https://github.com/frankmcsherry/blog/blob/master/posts/2015-07-31.md)

Malte and I did a bit deeper into the sources of the performance discrepancies between GraphX and Timely dataflow. We measure many things, and work through some neat time series that look like

![Timely](https://github.com/frankmcsherry/blog/blob/master/assets/timeseries/pagerank/timely_uk_16x8_10g/caelum-401.png)

---

#### [The impact of fast networks on graph analytics, part 1.](https://github.com/frankmcsherry/blog/blob/master/posts/2015-07-08.md)

Malte Schwarzkopf and I look in to the question of to what degree does improving networking help in graph computation. We do some measurement, comparing a PageRank implementation in both GraphX and in Timely dataflow.

---

#### [Differential graph computation](https://github.com/frankmcsherry/blog/blob/master/posts/2015-05-12.md)

Prompted by reader questions, we take a light tour through some of the things that differential dataflow can do.

<a href="http://www.youtube.com/watch?feature=player_embedded&v=WO23WBji_Z0
" target="_blank"><img src="http://img.youtube.com/vi/WO23WBji_Z0/0.jpg"
alt="IMAGE ALT TEXT HERE" width="240" height="180" border="10" /></a>

---

#### [Abomonation: terrifying serialization](https://github.com/frankmcsherry/blog/blob/master/posts/2015-05-04.md)

This post was so much fun to write. Also the code was fun to write. Imagine you want serialization to go as fast as possible, to still use Rust's type system, and maybe as a distant third requirement: memory safety. The approach isn't totally deranged, but please don't use it for your FinTech start-up (or at least let me short you if you do).

---

#### [Data-parallelism in timely dataflow](https://github.com/frankmcsherry/blog/blob/master/posts/2015-04-19.md)

Here we talk through, for the first time, how to write a data-parallel computation in timely dataflow. We use the example from the previous post: worst-case optimal joins. In cleaning up the text, I've realized that a good deal of it is out of date, so for code examples that actually work you mant want to check out the [intro to timely dataflow](https://github.com/frankmcsherry/blog/blob/master/posts/2015-09-14.md).

---

#### [Worst-case optimal joins, in dataflow](https://github.com/frankmcsherry/blog/blob/master/posts/2015-04-11.md)

Would you be surprised to learn that for the last 40 years databases have been performing complex joins asymptotically suboptimally? How about instead, you learn how to write worst-case optimal joins (credit to Ngo et al) in timely dataflow.

---

#### [Differential dataflow](https://github.com/frankmcsherry/blog/blob/master/posts/2015-04-07.md)

This was a warning shot to incremental computation folks that differential dataflow would ride again. It is pretty rough, though. It was mostly just about getting off the ground, and me being surprised at how simple it was to get a functional prototype up and running on top of timely dataflow infrastructure. Since this post, [differential dataflow](https://github.com/frankmcsherry/differential-dataflow) has gotten much better.

---

#### [Bigger data; same laptop](https://github.com/frankmcsherry/blog/blob/master/posts/2015-02-04.md)

Based on the great reaction to the COST post, and in particular questions of "is it really big data?", I went and downloaded a 1TB graph dataset from [Common Crawl](http://commoncrawl.org). Then I ran the same algorithms using this dataset, and it was totally fine and I got measurements. Given that most of the other systems go belly up on much smaller datasets, we don't have measurements for them.

---

#### [Scalability! But at what COST?](https://github.com/frankmcsherry/blog/blob/master/posts/2015-01-15.md)

Surprise! My laptop is faster than many compute clusters running things like Spark, Giraph, GraphLab, and GraphX. This post relates work that Michael Isard, Derek Murray, and I did trying to provide reasonable baselines for graph processing systems, where we conclude that ZOMG are the current crop of systems nowhere near what you can do with one thread and about 10-20 lines of code.

---

#### [Timely dataflow: core concepts](https://github.com/frankmcsherry/blog/blob/master/posts/2014-12-29.md)

An introduction to some of the key concepts in the timely dataflow rethink. Rust imposes some restrictions, but generally there are smart changes to make to how a system views hierarchical dataflow graphs, from how Naiad did it (a flat pile of nodes and edges).

---

#### [Timely dataflow: reboot](https://github.com/frankmcsherry/blog/blob/master/posts/2014-12-27.md)

Notes about how I'm planning on doing this timely dataflow thing again, and why it is going to wreck shit. 

---

#### [Columnarization in Rust, part 2](https://github.com/frankmcsherry/blog/blob/master/posts/2014-12-16.md)

Following on the previous on columnarization, we look more at how trait implementations can come into conflict, and one way to sort this out.

---

#### [Columnarization in Rust](https://github.com/frankmcsherry/blog/blob/master/posts/2014-12-15.md)

My first post on Rust, about a simple approach to columnar serialization using Rust traits.
