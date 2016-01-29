extern crate time;
extern crate timely;
extern crate graph_scaling;

use graph_scaling::fetch_edges;

use timely::dataflow::*;
use timely::dataflow::operators::*;
use timely::dataflow::channels::pact::Exchange;

fn main () {

    timely::execute_from_args(std::env::args(), move |root| {

        let index = root.index() as usize;
        let peers = root.peers() as usize;

        // fetch edges and pin cores (optional).
        let (graph, nodes) = fetch_edges(index, peers);

        let mut edges = Vec::new();
        let mut ranks = vec![1.0; (nodes / peers) + 1];   // holds ranks

        root.scoped(|scope| {

            // define a loop variable: messages from nodes to neighbors.
            let (cycle, ranks) = scope.loop_variable::<(u32, f32)>(20, 1);

            // describe how to route edge and rank data
            let edge_exchange = Exchange::new(|x: &(u32,u32)| x.0 as u64);
            let rank_exchange = Exchange::new(|x: &(u32,f32)| x.0 as u64)

            graph
                .into_iter()
                .to_stream(scope)
                .binary_notify(&ranks, edge_exchange, rank_exchange, "pagerank", vec![],
                    move |input1, input2, output, progress| {

                    // receive incoming edges (should only be iter 0)
                    while let Some((iter, data)) = input1.next() {
                        progress.notify_at(&iter);
                        for (src,dst) in data.drain(..) {
                            edges.push((src / (peers as u32),dst));
                        }
                    }

                    // all inputs received for iter, commence multiplication
                    while let Some((iter, _)) = progress.next() {

                        // wander through destinations
                        let mut session = output.session(&iter);
                        for &(src,dst) in &edges {
                            session.give((dst, ranks[src as usize]));
                        }

                        // clear the values; optional.
                        for s in &mut ranks { *s = 0.0; }
                    }

                    // receive data from workers, accumulate in src
                    while let Some((iter, data)) = input2.next() {
                        progress.notify_at(&iter);
                        for &(node, rank) in data.iter() {
                            ranks[node as usize / peers] += rank;
                        }
                    }
                })
                .connect_loop(cycle);
        });
    }); 
}