---
layout: post
title:  "Timely dataflow: reboot"
date:   2014-12-27 14:00:00
categories: dataflow naiad
published: true
---

Dataflow is a popular basis for many scalable computations, because the structure of the computation is committed to in advance of the execution, and the only responsibility of workers is to react to incoming data. The primary responsibility of the host system is to deliver the data to the appropriate workers, and this is a reasonably tractable task.

Many practical dataflow systems need additional features beyond simple data delivery. The most immediate need is the ability to tell a worker that they have received all of the data they should expect. This allows the worker to complete their computation, issue outgoing messages, and clean up persistent state. At finer granularities, streaming dataflow systems need the ability to tell a worker when they have received all of the data for a logical subset of their input, for example the end of a logical batch for which output is required.

## Naiad and timely dataflow ##

Timely dataflow is the name we used to describe [Naiad](http://research.microsoft.com/Naiad/)'s dataflow model. The model involves a directed (possibly cyclic) graph along whose edges messages (data) flow, and a partially ordered set of timestamps that adorn each message. Each message notionally exists at a *location* in the graph at a logical *time*, the pair of which we referred to as a *pointstamp*. As above, these pointstamps may have nothing to do with physical time; they often reflected progress through a stream (indicating the epoch of input data), or progress around a loop (indicating the iteration).

The imposition of a few structural constraints (elided) on the dataflow graph ensures a partial order on (location, timestamp) pairs. This means that for any set of pointstamps, messages at one might possibly result in the production of messages at another, but there can be no cycle among them. While the absence of a *total* order means we cannot name an "earliest" pointstamp in our set, we can nonetheless establish a set of pointstamps that will never be seen again once we have delivered their corresponding messages.

### Tracking progress in Naiad

Naiad's task is to maintain an understanding of which pointstamps were still in play at any time, so that each of its workers would know when they were certain to never see a given pointstamp again. There are several approaches here, I recommend the [Out-of-Order Processing](http://www.vldb.org/pvldb/1/1453890.pdf) paper as a good starting point. Naiad's approach can be summarized quite easily, though.

Progress tracking in Naiad is essentially distributed reference counting. Each worker maintains a count for each pointstamp of the number of messages it believes are still live (reference counts). When a worker processes a message at a pointstamp, it may produce output messages at other pointstamps; it broadcasts to each worker the increments for each output pointstamp and the decrement for the input pointstamp.

Naiad contains several optimizations to this approach, mostly identifying times where a worker can safely accumulate reference count updates without risking stalling the system. These mostly involve noticing that it still has work to do for a decrement it might send, and should just wait until it has finished things out, as the partial information will not allow others to make progress.

### Limitations of Naiad's approach

The timely dataflow graph Naiad manages has some structure, Naiad's representation of it in its progress tracking logic is simply as a directed graph. Although the vertices may have different types of timestamps, they are restricted to tuples of integers of varying arity. This is due to Naiad's need to declare a common type for pointstamps, so that they may be compared among other things. Exploiting the full generality of timely dataflow, choosing different partial orders for different subgraphs, did not seem possible in a type-safe manner in Naiad.

## Re-thinking timely dataflow

I've been given some time to reflect on how to structure progress tracking in timely dataflow, and I've come up with something different and appealing. The approach models timely dataflow graphs hierarchically, where a subgraph presents upwards as a vertex to the graph layer above it, concealing implementation details and presenting a minimal (detailed soon) coordination interface.

It's not fully built yet, so it is hard to say if it will be better, but it does have several appealing advantages over Naiad's approach:

*   Subgraphs may augment their timestamps with any partially ordered set.

    While integers are still likely to be popular, this allows types like `DateTime` at the root scope, `(uint, uint)` priorities (faked out in Naiad), and `Vec<Stack>` for recursive computations. It also results in not requiring dynamically allocated memory for the core timestamp types.

*   Subgraphs may easily coordinate among subsets of workers.

    This allows tighter coordination when appropriate, for example when workers on a machine want to aggregate values before transmitting them. This also allows a much simpler implementation of "impersonation", an oft commented-out Naiad feature which accelerates coordination when it is known that some edges will not exchange data.

*   Subgraphs may be implemented in other languages, or on other runtimes.

    Our choice of C# and .NET was not especially popular, but at the same time the use of Java is largely antithetical to performant systems building. A natural compromise is to build coordination logic, and other necessary services, in a language the user isn't expected to know, and allow them to write their application in their environment of choice.

*   Subgraphs may coordinate without involving the data plane.

    Naiad's design largely achieved this, but it was too convenient in its implementation to couple data transmission with progress updates. This design requires that they be initially separate, though clearly convenience layers can be built. This feature is meant to support transmission of data through other media, including distributed file systems and shared queues.

## Upcoming posts

My goal with this project is to see how much can be teased out of the idea of big-data system as operating system; what is the minimal set of services and features a platform needs to provide for scalable computation, without otherwise constraining the programs it runs.

My plan is to put out posts on a few of the related topics over the next few weeks, as progress is made. There is [a prototype currently up and running with the new approach](https://github.com/frankmcsherry/timely-dataflow), doing things from the mundane data-parallel `distinct()`, to the new-and-cool subgraphs backed by external processes connected to the coordinator by just unix pipes (ok, I admit it; the external processes are in Rust too). It exchanges data over threads, but not yet over network connections, and there is a bit of tooling to make it more pleasant to use.
