WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as line
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),

    split1(r INT, dr INT, dc INT, steps INT) AS (
        SELECT
            r,
            CASE WHEN regexp_split_to_array(line, ' ')[1] = 'U' THEN -1 
                 WHEN regexp_split_to_array(line, ' ')[1] = 'D' THEN  1
                 ELSE 0
            END,
            CASE WHEN regexp_split_to_array(line, ' ')[1] = 'L' THEN -1 
                 WHEN regexp_split_to_array(line, ' ')[1] = 'R' THEN  1
                 ELSE 0
            END,
            regexp_split_to_array(line, ' ')[2]::INT
        FROM lines
    ),

    -- Part 1 is prefix sum followed by area calculations.
    -- We'll brute force the prefix sum part, and use the
    -- "trapezoid formula", summing + and - contributions
    -- as the path moves around.
    path1(r1 INT, c1 INT, r2 INT, c2 INT, rounds INT) AS (
        SELECT 0, 0, 0, 0, 1
        UNION
        SELECT 
            path1.r2,
            path1.c2,
            path1.r2 + split1.dr * split1.steps, 
            path1.c2 + split1.dc * split1.steps, 
            path1.rounds + 1
        FROM path1, split1
        WHERE path1.rounds = split1.r
    ),
    -- The area carved by the path, plus half a unit of area
    -- for each path step, plus 4 * (1/4) units for the net
    -- four 90 degree turns.
    part1(part1 BIGINT) AS (
        SELECT 
            ABS((SELECT SUM((r1 + r2) * (c1 - c2)) FROM path1)) / 2
          + (SELECT SUM(steps) FROM split1) / 2
          + 1
    ),

    -- Part 2 changes how we parse each line to give long paths.
    split2(r INT, dr INT, dc INT, steps INT) AS (
        SELECT
            r,
            CASE WHEN substring(regexp_split_to_array(line, ' ')[3], 8, 1) = '3' THEN -1 
                 WHEN substring(regexp_split_to_array(line, ' ')[3], 8, 1) = '1' THEN  1
                 ELSE 0
            END,
            CASE WHEN substring(regexp_split_to_array(line, ' ')[3], 8, 1) = '2' THEN -1 
                 WHEN substring(regexp_split_to_array(line, ' ')[3], 8, 1) = '0' THEN  1
                 ELSE 0
            END,
            256 * 256 * get_byte(decode('0' || substring(regexp_split_to_array(line, ' ')[3], 3, 5), 'hex'), 0)
                + 256 * get_byte(decode('0' || substring(regexp_split_to_array(line, ' ')[3], 3, 5), 'hex'), 1)
                      + get_byte(decode('0' || substring(regexp_split_to_array(line, ' ')[3], 3, 5), 'hex'), 2)
        FROM lines
    ),

    path2(r1 BIGINT, c1 BIGINT, r2 BIGINT, c2 BIGINT, rounds INT) AS (
        SELECT 0, 0, 0, 0, 1
        UNION
        SELECT
            path2.r2,
            path2.c2,
            path2.r2 + split2.dr * split2.steps, 
            path2.c2 + split2.dc * split2.steps, 
            path2.rounds + 1
        FROM path2, split2
        WHERE path2.rounds = split2.r
    ),
    -- The area carved by the path, plus half a unit of area
    -- for each path step, plus 4 * (1/4) units for the net
    -- four 90 degree turns.
    part2(part2 BIGINT) AS (
        SELECT 
            ABS((SELECT SUM((r1 + r2) * (c1 - c2)) FROM path2)) / 2
          + (SELECT SUM(steps) FROM split2) / 2
          + 1
    )

SELECT * FROM part1, part2;
