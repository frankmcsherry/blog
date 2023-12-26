WITH MUTUALLY RECURSIVE (RETURN AT RECURSION LIMIT 30)

        lines (line TEXT, line_no INT) AS (
            SELECT regexp_split_to_array(input, '\n')[i], i
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) i
        ),

        numbers(value INT, line_no INT, col_no INT) AS (
            SELECT regexp_split_to_array(line, ' ')[j]::INT, line_no, j
            FROM lines, generate_series(1, array_length(regexp_split_to_array(line, ' '), 1)) j
        ),

        -- Contains non-zero values of differences after each round.
        derivatives(value INT, line_no INT, col_no INT, round INT) AS (
            SELECT numbers.*, 1 
            FROM numbers
            UNION
            SELECT 
                COALESCE(i2.value, 0) - COALESCE(i1.value, 0), 
                COALESCE(i1.line_no, i2.line_no), 
                COALESCE(i1.col_no + 1, i2.col_no), 
                COALESCE(i1.round, i2.round) + 1
            FROM derivatives i1 FULL OUTER JOIN derivatives i2 ON (i1.line_no = i2.line_no AND i1.round = i2.round AND i1.col_no + 1 = i2.col_no) 
            WHERE COALESCE(i2.value, 0) - COALESCE(i1.value, 0) != 0
              AND COALESCE(i1.col_no + 1, i2.col_no) > COALESCE(i1.round, i2.round)
              AND COALESCE(i1.col_no + 1, i2.col_no) <= 21
        ),

        -- Accumulate the derivatives at the leading edge
        part1(part1 BIGINT) AS (
            SELECT SUM(value) 
            FROM derivatives
            WHERE col_no = 21
        ),

        -- Accumulate the derivatives at the preceding edge
        part2(part2 BIGINT) AS (
            SELECT SUM(pow(-1, round + 1) * value)
            FROM derivatives
            WHERE col_no = round 
        )

    -- SELECT * FROM derivatives WHERE line_no = 1 ORDER BY round, col_no;
    SELECT * FROM part1, part2;