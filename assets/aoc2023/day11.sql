WITH MUTUALLY RECURSIVE

        lines(line TEXT, r INT) AS (
            SELECT regexp_split_to_array(input, '\n')[i], i
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) i
        ),

        symbols(symb TEXT, r INT, c INT) as (
            SELECT substring(line, j, 1), r, j
            FROM lines, generate_series(1, length(line)) j
        ),

        row_gaps(r INT) AS (
            SELECT r
            FROM symbols
            GROUP BY r
            HAVING COUNT(*) FILTER (WHERE symb = '#') = 0
        ),

        col_gaps(c INT) AS (
            SELECT c
            FROM symbols
            GROUP BY c
            HAVING COUNT(*) FILTER (WHERE symb = '#') = 0
        ),

        -- Part1: Expand space and restrict to galaxies
        galaxies(r INT, c INT) AS (
            SELECT 
                r + (SELECT COUNT(*) FROM row_gaps WHERE row_gaps.r < symbols.r),
                c + (SELECT COUNT(*) FROM col_gaps WHERE col_gaps.c < symbols.c)
            FROM symbols
            WHERE symb = '#'
        ),
        -- Sum of L1 distance between distinct galaxies
        part1(part1 BIGINT) AS (
            SELECT SUM(ABS(g1.r - g2.r) + ABS(g1.c - g2.c))
            FROM galaxies g1, galaxies g2
            WHERE g1.r < g2.r 
               OR (g1.r = g2.r AND g1.c < g2.c)
        ),

        -- Part2: Expand space MORE and restrict to galaxies
        galaxies2(r INT, c INT) AS (
            SELECT 
                r + 999999 * (SELECT COUNT(*) FROM row_gaps WHERE row_gaps.r < symbols.r),
                c + 999999 * (SELECT COUNT(*) FROM col_gaps WHERE col_gaps.c < symbols.c)
            FROM symbols
            WHERE symb = '#'
        ),
        -- Sum of L1 distance between distinct galaxies
        part2(part2 BIGINT) AS (
            SELECT SUM(ABS(g1.r - g2.r) + ABS(g1.c - g2.c))
            FROM galaxies2 g1, galaxies2 g2
            WHERE g1.r < g2.r 
               OR (g1.r = g2.r AND g1.c < g2.c)
        )

    SELECT * FROM part1, part2;