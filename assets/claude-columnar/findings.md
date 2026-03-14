# Decode Performance Findings — March 2026

These findings document work on improving the decode path in the `columnar` crate,
specifically the pipeline from binary `&[u64]` data through `Indexed::decode` and
`FromBytes` to typed field access. The work was done collaboratively (Frank McSherry
and Claude), and this file is intended to provide a blog-writing session with all the
context, data, and narrative structure needed to write a post.

## The setup

Columnar stores typed data (tuples, strings, vectors, enums) as columns of primitives.
These columns are serialized into `&[u64]` using the `Indexed` encoding: an array of
byte offsets followed by the data, with u64 alignment padding. To read the data back,
you call `decode` (which produces `&[u8]` slices from the `&[u64]` store) and then
`from_bytes` (which casts each `&[u8]` slice back to a typed slice like `&[u64]` or
`&[u32]`).

The hot path is `Stash::borrow`, which goes from raw binary bytes to a typed borrowed
container in a single call. This backs every read of serialized columnar data.

## The story in three acts

### Act 1: Improving decode codegen (old -> mid)

The first round of work (commits `9efed3e`, `27bb5af`) improved the `Indexed::decode`
function itself:

**Before:** `decode` called `decode_index` per element. Each call did `try_into().unwrap()`
(u64 to usize), `try_cast_slice().expect()` (u64 to u8), and unchecked bounds on
`&bytes[lower..upper]`. The `decode` function was not `#[inline(always)]`.

**After:** `decode` was marked `#[inline(always)]`, pre-computed the `bytes` and `index`
slices once, and used `.min()` patterns to make bounds checks provably unnecessary:
```rust
let upper = (index[i + 1] as usize).min(last);
let lower = (((index[i] as usize) + 7) & !7).min(upper);
&bytes[lower .. upper]  // LLVM can prove lower <= upper <= bytes.len()
```

This converted panicking branches to branchless `csel` (conditional select) instructions.

**Assembly impact (accessing field 0 of a k-tuple, `from_bytes` path):**

| Tuple width | Old (insns/branches) | Mid (insns/branches) |
|---|---|---|
| k=1 | 73 / 7 | 77 / 8 |
| k=3 | 126 / 17 | 133 / 14 |
| k=5 | 155 / 27 | 189 / 20 |
| k=8 | 191 / 42 | 273 / 29 |

**The surprise:** instructions actually *increased* while branches decreased. The `.min()`
patterns replaced panicking branches with branchless `csel` instructions — more instructions
but fewer misprediction-prone branches. And timing showed essentially no difference in a
hot loop, because the branch predictor handled both versions perfectly.

**The deeper problem:** both versions scale linearly with k. Accessing field 0 of an
8-tuple costs 4x more than a 1-tuple. The decode improvement was real but narrow — it
didn't address the fundamental scaling issue.

### Act 2: Discovering why it scales (mid -> now, investigation)

We ran a series of experiments to isolate where the O(k) cost comes from:

**Experiment: separating the pipeline stages.**
We measured `decode` only, `from_bytes` only, and `get` only independently:

| Stage | k=3 (insns/branches) | k=8 (insns/branches) |
|---|---|---|
| get only (tuple already built) | 13 / 1 | 13 / 1 |
| from_bytes only (slices ready) | 81 / 10 | 186 / 25 |
| full pipeline | 131 / 14 | 271 / 29 |

**Finding:** `get` is O(1) — 13 instructions regardless of tuple width. The cost is
entirely in `from_bytes`, which eagerly constructs ALL fields even when only one is used.

**Why can't LLVM eliminate unused fields?** Because each field's construction can panic:
1. `bytes.next().expect("exhausted")` — iterator might be empty
2. `bytemuck::try_cast_slice(bytes).unwrap()` — alignment might be wrong
3. `&all[..all.len() - trim]` — subtraction might underflow

Panics are observable side effects. If field 2's construction would panic, the program
must panic there — not silently return field 0's value. Rust's deterministic error
semantics require this.

**The key insight:** the `&[u8]` in the interface is where alignment information dies.
The data starts as `&[u64]` (guaranteed aligned), `decode` returns `&[u8]` (alignment
lost), and `from_bytes` must re-prove alignment via `try_cast_slice` for every field.
We're throwing away information and paying to re-establish it.

### Act 3: The fix (mid -> now, implementation)

Three changes, each building on the previous:

**1. `decode_u64s`: keep `&[u64]` through the pipeline.**

Instead of returning `&[u8]` slices, return `(&[u64], u8)` pairs — the word slice plus
the number of valid trailing bytes (for sub-u64 types like `&[u32]` or `&[u8]` where
the last word may be partial).

```rust
pub fn decode_u64s(store: &[u64]) -> impl Iterator<Item=(&[u64], u8)>
```

Since all casts from `&[u64]` to smaller types are infallible (u64 alignment >= all
primitive alignments), the alignment checks vanish entirely.

**2. `from_u64s`: non-panicking field construction.**

```rust
// Old (panicking):
let (w, tail) = words.next().expect("exhausted");
let all: &[u64] = bytemuck::try_cast_slice(bytes).unwrap();

// New (non-panicking):
let (w, tail) = words.next().unwrap_or((&[], 0));
let all: &[$type] = bytemuck::cast_slice(w);  // infallible
all.get(..all.len().wrapping_sub(trim)).unwrap_or(&[])
```

With no panics anywhere, field construction is pure — no observable side effects.
LLVM can now eliminate unused fields as dead code.

**3. Non-panicking decode closure.**

The decode iterator's closure also had panicking index accesses (`index[i+1]`).
Changed to `index.get(i+1).unwrap_or(&0)` with `.min()` patterns to keep all
bounds provable.

**Assembly impact (three-way comparison, accessing field 0):**

| Tuple width | Old (insns/branches) | Mid (insns/branches) | Now via from_u64s (insns/branches) |
|---|---|---|---|
| k=1 | 73 / 7 | 77 / 8 | 68 / 7 |
| k=2 | 100 / 12 | 105 / 11 | 68 / 7 |
| k=3 | 126 / 17 | 133 / 14 | 68 / 7 |
| k=5 | 155 / 27 | 189 / 20 | 68 / 7 |
| k=8 | 191 / 42 | 273 / 29 | **68 / 7** |

**Old and mid scale linearly. Now is constant.**

For accessing the last field, there is a small O(j) cost from iterator advancement
(LLVM unrolls as `cinc` chains for small j, switches to a loop for j >= 16). This
could be eliminated with random-access `decode_field` instead of iterator-based
consumption, but is already well-optimized.

## The meta-lesson

The old -> mid improvement looked promising: fewer branches (42 -> 29 for 8-tuple).
But it actually regressed on instructions (191 -> 273) and didn't change the O(k)
scaling at all. We only discovered this by measuring assembly, not just timing —
timing in a hot loop was identical because the branch predictor handled both perfectly.

The mid -> now improvement came from asking "why doesn't this scale?" and tracing the
answer through four layers of panicking operations, each requiring the same fix:
replace panicking operations with non-panicking alternatives that return garbage on
bad data instead of crashing. This isn't `unsafe` — there's no undefined behavior.
The trade-off is explicit: validation happens once at the trust boundary (via
`FromBytes::validate`), and the fast path trusts the data.

## Code changes

The changes are on branch `decode_u64s`:

- `src/bytes.rs`: `decode_u64s` function, `validate` function, removed `EncodeDecode`
  trait and `Sequence` encoding, renamed module to `indexed`
- `src/lib.rs`: `from_u64s` and `element_sizes` on `FromBytes`, `validate` method
- `src/primitive.rs`: non-panicking `from_u64s` for all primitive types
- `src/tuple.rs`: delegating `from_u64s` and `element_sizes`
- `src/string.rs`, `src/vector.rs`, `src/sums.rs`: delegating implementations
- `src/arc.rs`, `src/rc.rs`, `src/boxed.rs`: delegating wrappers
- `columnar_derive/src/lib.rs`: `from_u64s` and `element_sizes` in derive macros

## Key code examples for the post

**The type-level information loss:**
```
&[u64] (store) -> decode -> &[u8] (alignment lost!) -> from_bytes -> try_cast_slice back to &[u64] (must re-prove!)
```

**The fix — keep `&[u64]` throughout:**
```
&[u64] (store) -> decode_u64s -> (&[u64], u8) (alignment preserved) -> from_u64s -> typed slice (infallible cast)
```

**Non-panicking construction enables dead code elimination:**
```rust
// Panicking: LLVM must keep this even if result is unused
let field = bytemuck::try_cast_slice(bytes.next().expect("exhausted")).unwrap();

// Non-panicking: LLVM can eliminate if result is unused
let field = match words.next() {
    Some((w, _)) => bytemuck::cast_slice(w),  // infallible
    None => &[],
};
```

**Validation at the boundary:**
```rust
// Once, when receiving data:
type MyBorrowed<'a> = <MyContainer as Borrow>::Borrowed<'a>;
MyBorrowed::validate(&store)?;

// Then, many times, with O(1) field access:
let borrowed = MyBorrowed::from_u64s(&mut decode_u64s(&store));
borrowed.get(index)  // constant time regardless of tuple width
```
