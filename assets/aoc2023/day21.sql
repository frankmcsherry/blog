WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as block
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),
    cells(r INT, c INT, symbol TEXT) AS (
        SELECT r, c, substring(line, c, 1)
        FROM lines, generate_series(1, length(line)) c
    ),

    steps(r INT, c INT) AS (
        SELECT r, c FROM cells WHERE symbol = 'S'
        EXCEPT ALL
        SELECT * FROM s_delay
        UNION 
        SELECT cells.r, cells.c
        FROM cells, (
                  SELECT r + 1, c FROM steps
            UNION SELECT r - 1, c FROM steps
            UNION SELECT r, c + 1 FROM steps
            UNION SELECT r, c - 1 FROM steps
        ) as potato(r,c)
        WHERE cells.r = potato.r
          AND cells.c = potato.c
          AND cells.symbol != '#'
    ),

    s_delay(r INT, c INT) AS (
        SELECT r, c FROM cells WHERE symbol = 'S'
    ),

    part1(part1 BIGINT) AS (
        SELECT COUNT(*) FROM (SELECT DISTINCT * FROM steps)
    ),

    -- PART 2 wants a much larger step count on an infinite repeating grid.
    -- We know it will be quadratic based on the clear paths if nothing else.
    -- Map out enough points to reverse out polynomial coefficients.
    -- For me they were `ax^2 + bx + c` with a = 60724, b = 30602, c =  3849.

    dists(r INT, c INT, d INT) AS (
        SELECT r, c, MIN(d) 
        FROM (
            SELECT r, c, 0 d 
            FROM cells 
            WHERE symbol = 'S'
            UNION ALL 
            SELECT potato.r, potato.c, d + 1
            FROM cells, (
                      SELECT r + 1, c, d FROM dists
                UNION SELECT r - 1, c, d FROM dists
                UNION SELECT r, c + 1, d FROM dists
                UNION SELECT r, c - 1, d FROM dists
            ) as potato(r,c,d)
            WHERE cells.r = 1 + (((potato.r - 1) % 131) + 131) % 131
              AND cells.c = 1 + (((potato.c - 1) % 131) + 131) % 131
              AND cells.symbol != '#'
              AND potato.d < 1000
        )
        GROUP BY r, c
    ),

    part2(x0 BIGINT, x2 BIGINT, x4 BIGINT, x6 BIGINT) AS (
        SELECT 
            (SELECT COUNT(*) FROM dists WHERE d <=  0 * 131 + 65 AND d % 2 = 1),
            (SELECT COUNT(*) FROM dists WHERE d <=  2 * 131 + 65 AND d % 2 = 1),
            (SELECT COUNT(*) FROM dists WHERE d <=  4 * 131 + 65 AND d % 2 = 1),
            (SELECT COUNT(*) FROM dists WHERE d <=  6 * 131 + 65 AND d % 2 = 1)
    ),

    potato (x INT) AS ( SELECT 1 )

SELECT 'idk';