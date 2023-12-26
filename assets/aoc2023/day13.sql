 WITH MUTUALLY RECURSIVE

        blocks(b INT, block TEXT) AS (
            SELECT b, regexp_split_to_array(input, '\n\n')[b] as block
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n\n'), 1)) b
        ),
        lines(b INT, r INT, line TEXT) AS (
            SELECT b, r, regexp_split_to_array(block, '\n')[r] as block
            FROM blocks, generate_series(1, array_length(regexp_split_to_array(block, '\n'), 1)) r
        ),
        cells(b INT, r INT, c INT, symbol TEXT) AS (
            SELECT b, r, c, substring(line, c, 1)
            FROM lines, generate_series(1, length(line)) c
        ),
        columns(b INT, c INT, column TEXT) AS (
            SELECT b, c, string_agg(symbol, '' ORDER BY r) FROM cells GROUP BY b, c
        ),

        row_mirror(b INT, r INT) AS (
            SELECT *
            FROM (SELECT DISTINCT b, r FROM cells) o
            WHERE NOT EXISTS (
                -- We would be upset to find rows at mirrored positions that do not match
                -- Rows that match, or have no mirrored position, are fine.
                SELECT FROM lines
                WHERE o.b = lines.b
                GROUP BY abs(2 * lines.r - (2 * o.r - 1))
                HAVING COUNT(DISTINCT lines.line) > 1
            )
        ),

        col_mirror(b INT, c INT) AS (
            SELECT *
            FROM (SELECT DISTINCT b, c FROM cells) o
            WHERE NOT EXISTS (
                -- We would be upset to find rows at mirrored positions that do not match
                -- Rows that match, or have no mirrored position, are fine.
                SELECT FROM columns
                WHERE o.b = columns.b
                GROUP BY abs(2 * columns.c - (2 * o.c - 1))
                HAVING COUNT(DISTINCT columns.column) > 1
            )
        ),

        part1(part1 BIGINT) AS (
            SELECT COALESCE((SELECT SUM(r-1) FROM row_mirror), 0) * 100
                 + COALESCE((SELECT SUM(c-1) FROM col_mirror), 0)
        ),

        row_mirror2(b INT, r INT) AS (
            SELECT *
            FROM (SELECT DISTINCT b, r FROM cells) o
            WHERE 1 = (
                SELECT COUNT(*)
                FROM cells c1, cells c2
                WHERE abs(2 * c1.r - (2 * o.r - 1)) = abs(2 * c2.r - (2 * o.r - 1))
                  AND c1.r < c2.r
                  AND c1.c = c2.c
                  AND c1.b = c2.b
                  AND c1.b = o.b
                  AND c1.symbol != c2.symbol
            )
        ),

        col_mirror2(b INT, c INT) AS (
            SELECT *
            FROM (SELECT DISTINCT b, c FROM cells) o
            WHERE 1 = (
                SELECT COUNT(*) 
                FROM cells c1, cells c2
                WHERE abs(2 * c1.c - (2 * o.c - 1)) = abs(2 * c2.c - (2 * o.c - 1))
                  AND c1.c < c2.c
                  AND c1.r = c2.r
                  AND c1.b = c2.b
                  AND c1.b = o.b
                  AND c1.symbol != c2.symbol
            )
        ),

        part2(part2 BIGINT) AS (
            SELECT COALESCE((SELECT SUM(r-1) FROM row_mirror2), 0) * 100
                 + COALESCE((SELECT SUM(c-1) FROM col_mirror2), 0)
        ),

        potato (x INT) AS ( SELECT 1 )

    SELECT * FROM part1, part2;