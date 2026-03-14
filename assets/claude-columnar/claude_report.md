# Report: Collaborating on columnar decode performance

This is my account of working with Frank on improving decode performance in the
columnar crate. It's written from my perspective as a collaborator — what I observed,
what I learned, and where I was wrong.

## What I expected going in

Frank had already merged two commits improving `Indexed::decode` codegen. I read the
diffs, understood the `.min()` patterns, and figured the story was straightforward:
old code had unnecessary panicking operations, new code removed them, performance
improved. I expected to help quantify the improvement and move on.

## What actually happened

### The benchmarks showed nothing

The first surprise: timing benchmarks showed **no measurable difference** between old
and new code. In a hot loop, the branch predictor handled both versions perfectly.
Single-digit nanosecond operations, identical within noise. The "improvement" was
invisible to timing.

This was uncomfortable. We had a clear codegen story (fewer branches, `.min()` patterns)
but the data didn't support it. Frank's response was instructive: instead of defending
the improvement, he pushed into understanding *why* the timing was unchanged and *what
experiments would reveal the actual impact*.

### Assembly told a different story than timing

When we switched to counting assembly instructions, the picture inverted in a way I
didn't expect: the new code had **more** instructions than the old code (273 vs 191 for
an 8-tuple). The `.min()` patterns had replaced cheap predicted branches with branchless
`csel` instructions. Fewer branches, more instructions, same timing. The improvement
was real but showed up in a dimension we hadn't measured — code quality and worst-case
behavior, not throughput.

### The O(k) scaling was the real problem

Frank kept pushing: "can we confirm linear growth?" This led to the key finding that
both old and new code scale linearly with tuple width. Accessing one field constructs
all fields. I should have noticed this from the assembly data immediately — the
instruction counts were clearly linear — but I was focused on the old-vs-new comparison
rather than the scaling question.

The investigation into *why* LLVM can't eliminate unused fields taught me something
concrete about Rust's compilation model. It's not about LLVM being "not smart enough."
It's about semantics: a panicking operation is an observable side effect, and the
compiler *must not* remove it. This isn't a missed optimization — it's correct behavior.
The program's meaning changes depending on whether that panic runs.

### The `&[u8]` insight

Frank identified the root cause: `decode` returns `&[u8]`, which discards the alignment
guarantee that the `&[u64]` store provides. This forces `from_bytes` to re-verify
alignment via `try_cast_slice` for every field.

This is the kind of insight that's hard to get from staring at code alone. It comes from
understanding the data flow at a higher level: what information exists, where it's
created, and where it's lost. I had been focused on what the compiler *does* with the
code; Frank was thinking about what information the code *communicates*.

His suggestion of the `u8` trailing byte count (rather than a full `usize` byte count)
was another example of this — seeing that the only information lost by returning `&[u64]`
instead of `&[u8]` is how many bytes of the last word are valid, which fits in 3 bits.

### Peeling the onion

The implementation required four rounds of making operations non-panicking, each time
discovering another layer:

1. **`from_u64s` field construction**: `try_cast_slice` alignment checks. Fixed by
   casting directly from `&[u64]` to the target type (infallible for all primitives).

2. **The trim operation**: `&all[..all.len() - trim]` can underflow. Fixed with
   `.get(..all.len().wrapping_sub(trim)).unwrap_or(&[])`.

3. **Iterator exhaustion**: `.expect("exhausted")` panics. Fixed with
   `.unwrap_or((&[], 0))`.

4. **Decode closure index access**: `index[i+1]` bounds-checks. Fixed with
   `.get(i+1).unwrap_or(&0)`.

Each layer had to be found by building, checking assembly, seeing that LLVM still
wasn't eliminating dead fields, and figuring out which remaining operation was panicking.
After all four, the assembly went from 273 instructions (linear in k) to 68 instructions
(constant in k).

I found this process genuinely interesting — each fix seemed like it should be "the one"
that unlocked the optimization, and each time the assembly showed it wasn't enough yet.
The lesson is that dead code elimination is all-or-nothing: one panicking operation
anywhere in the chain prevents the entire chain from being eliminated.

### The validation trade-off

The non-panicking approach means bad data produces garbage instead of panics. Frank
framed this well: it's the same trade-off as `unsafe`, except with wrong answers
instead of undefined behavior. The fix was `FromBytes::validate` — check once at the
trust boundary, then use the fast path freely.

The design of the validation API itself went through a nice refinement: `element_sizes`
is the composable piece that types override (simple, one push per slice), while
`validate` is the derived method that callers use (does the structural + type checking).
Both are public, serving different audiences.

## What I learned

**Timing benchmarks can mislead.** Branch prediction makes predicted-not-taken branches
essentially free in hot loops. Assembly counts reveal codegen quality that timing hides.

**"Convert panics to non-panicking" is a codegen technique, not just a safety trade-off.**
The purpose isn't to silence errors — it's to communicate to LLVM that the code is pure,
enabling dead code elimination. The errors are handled elsewhere (validation).

**Type-level information loss has codegen consequences.** `&[u8]` vs `&[u64]` isn't just
a type annotation — it determines whether LLVM can prove alignment, which determines
whether it emits validation branches, which determines whether it can eliminate dead code.
The type IS the optimization.

**Stress-test your improvements.** The old -> mid improvement was real but incomplete.
If we'd stopped there, we would have claimed "fewer branches" without noticing that the
fundamental O(k) scaling was unchanged. Frank's instinct to keep pushing — "can we confirm
constant complexity?" — is what found the actual opportunity.

## What's left

The iterator-based `from_u64s` creates a sequential dependency when accessing the last
field of a wide tuple. LLVM handles this well (branchless unrolling for small N, loop
for large N), but a random-access `decode_field` approach would make it truly O(1) for
any field position. The assembly confirms this works (61 instructions, constant), but
wiring it into the `FromBytes` trait requires more design work.
