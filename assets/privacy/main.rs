#![feature(iter_arith)]
extern crate rand;

use rand::Rng;
use rand::distributions::{IndependentSample, Range};

fn main() {

	// generate random [-1,1] data.
    let mut rng = rand::thread_rng();
    let range2 = Range::new(-1.0, 1.0f64);

    let mut data = vec![];
    for _ in 0..10000 {
    	data.push((range2.ind_sample(&mut rng), range2.ind_sample(&mut rng)));
    }

    // determine the correct correlation. (note: very small error.)
    let truth = ppmcc(&data, 1000000.0);

    // repeatedly measure correlation.
    let epsilon = 0.5;
    for _ in 0..1000 {
    	println!("{}", ppmcc(&data, epsilon) - truth);
    }
}

// The Pearson product-moment correlation coefficient of two distributions X and Y 
// can be computed as: 
// 
//   (E[XY] - E[X]E[Y]) / (E[X^2] - E[X]^2)^{1/2} (E[Y^2] - E[Y]^2)^{1/2}
//
// which we do here with epsilon-differential privacy. 
fn ppmcc(data: &[(f64, f64)], epsilon: f64) -> f64 {

	// count the number of records, for the denominator of our expectations.
	let n = data.iter().map(|_| 1.0).noisy_sum(epsilon/6.0);

	// determine first moments by summing terms (with noise) and dividing by n.
	let ex = data.iter().map(|&(x,_)| x).noisy_sum(epsilon/6.0) / n;
	let ey = data.iter().map(|&(_,y)| y).noisy_sum(epsilon/6.0) / n;

	// determine second moments by summing products (with noise) and dividing by n.
	let ex2 = data.iter().map(|&(x,_)| x).map(|x| x * x).noisy_sum(epsilon/6.0) / n;
	let ey2 = data.iter().map(|&(_,y)| y).map(|y| y * y).noisy_sum(epsilon/6.0) / n;

	// determine product moment by summing products (with noise) and dividing by n.
	let exy = data.iter().map(|&(x,_)| x).zip(data.iter().map(|&(_,y)| y)).map(|(x,y)| x * y).noisy_sum(epsilon/6.0) / n;

	// return the Pearson product-moment correlation coefficient.
	(exy - (ex * ey)) / ((ex2 - (ex * ex)) * (ey2 - (ey * ey))).sqrt()
}

trait NoisySum {
	fn noisy_sum(self, epsilon: f64) -> f64;	
}

impl<I: Iterator<Item=f64>> NoisySum for I {
	// computes a sum with epsilon-differential privacy, thresholding elements as appropriate
	fn noisy_sum(self, epsilon: f64) -> f64 {
		let sum = self.map(|x| if x < -1.0 { -1.0 } else { x })
					  .map(|x| if x >  1.0 {  1.0 } else { x })
					  .sum::<f64>();

	  	sum + laplace(1.0/epsilon)	
	}	
}

// generates a sample from the Laplace distribution
fn laplace(scale: f64) -> f64 {
	let mut rng = rand::thread_rng();
	scale * (1.0 - rng.next_f64().ln()) * if rng.gen() { 1.0 } else { -1.0 }
}
