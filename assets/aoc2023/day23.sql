WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as line
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),

    cells(r INT, c INT, symbol TEXT) AS (
        SELECT r, c, substring(line, c, 1)
        FROM lines, generate_series(1, length(line)) c
    ),

    -- Part one: longest path (on probably a DAG)
    paths(r INT, c INT) AS (
        SELECT r, c FROM cells WHERE symbol = '.'
    ),

    steps(r1 INT, c1 INT, r2 INT, c2 INT) AS (
        SELECT r, c, r + 1, c FROM paths WHERE (r + 1, c) IN (SELECT * FROM PATHS) UNION
        SELECT r, c, r - 1, c FROM paths WHERE (r - 1, c) IN (SELECT * FROM PATHS) UNION
        SELECT r, c, r, c + 1 FROM paths WHERE (r, c + 1) IN (SELECT * FROM PATHS) UNION
        SELECT r, c, r, c - 1 FROM paths WHERE (r, c - 1) IN (SELECT * FROM PATHS)
    ),

    -- A directional trip, forced by a slope and the no-revisting rule.
    force(r1 INT, c1 INT, r2 INT, c2 INT) AS (
        SELECT r-1, c, r+1, c FROM cells WHERE symbol = 'v' UNION ALL
        SELECT r+1, c, r-1, c FROM cells WHERE symbol = '^' UNION ALL
        SELECT r, c-1, r, c+1 FROM cells WHERE symbol = '>' UNION ALL
        SELECT r, c+1, r, c-1 FROM cells WHERE symbol = '<'
    ),

    dists(r INT, c INT, d INT) AS (
        SELECT 1, 2, 0
        UNION 
        SELECT steps.r2, steps.c2, 1 + MIN(d)
        FROM dists, steps
        WHERE dists.r = steps.r1
          AND dists.c = steps.c1
        GROUP BY steps.r2, steps.c2
        UNION 
        SELECT force.r2, force.c2, 2 + MAX(d)
        FROM dists, force
        WHERE dists.r = force.r1
          AND dists.c = force.c1
        GROUP BY force.r2, force.c2
    ),

    -- Part two: longest path on definitely not a DAG.
    -- There are 32 optional nodes (not including first and last nodes)
    -- Clearly meant to pack in to an int and avoid duplication.
    paths2(r INT, c INT) AS (
        SELECT r, c FROM cells WHERE symbol != '#'
    ),

    steps2(r1 INT, c1 INT, r2 INT, c2 INT) AS (
        SELECT r, c, r + 1, c FROM paths2 WHERE (r + 1, c) IN (SELECT * FROM paths2) UNION
        SELECT r, c, r - 1, c FROM paths2 WHERE (r - 1, c) IN (SELECT * FROM paths2) UNION
        SELECT r, c, r, c + 1 FROM paths2 WHERE (r, c + 1) IN (SELECT * FROM paths2) UNION
        SELECT r, c, r, c - 1 FROM paths2 WHERE (r, c - 1) IN (SELECT * FROM paths2)
    ),
    -- Locations where a choice exists (or start/end).
    nodes(r INT, c INT) AS (
        SELECT r1, c1 FROM steps2 GROUP BY r1, c1 HAVING COUNT(*) != 2
    ),
    -- Determine node-to-node path lengths. Do not cross nodes.
    trail(r1 INT, c1 INT, d INT, r2 INT, c2 INT) AS (
        SELECT r1, c1, MIN(d), r2, c2
        FROM (
            SELECT r1, c1, 1 d, r2, c2 FROM steps2 WHERE (r1, c1) IN (SELECT * FROM nodes)
            UNION ALL
            SELECT trail.r1, trail.c1, d + 1, steps2.r2, steps2.c2
            FROM trail, steps2
            WHERE trail.r2 = steps2.r1
            AND trail.c2 = steps2.c1
            AND (trail.r1 != steps2.r2 OR trail.c1 != steps2.c2)
            AND (steps2.r1, steps2.c1) NOT IN (SELECT * FROM nodes)
        )
        GROUP BY r1, c1, r2, c2
    ),

    links(r1 INT, c1 INT, d INT, r2 INT, c2 INT) AS (
        SELECT * FROM trail WHERE (r2, c2) IN (SELECT * FROM nodes)
    ),

    -- These rows in links show that (12, 20) and (130, 126) are mandatory,
    -- and are the first moments we have a choice. The remainaing 32 nodes
    -- can each get a number, and be used in a bit pattern somewhere.
    --
    --          1 |   2 | 105 |  12 |  20
    --        141 | 140 | 121 | 130 | 126

    -- Re-key nodes to dense integers.
    internal(r INT, c INT, id INT) AS (
        SELECT r, c, (
            SELECT COUNT(*) 
            FROM nodes n1 
            WHERE (n1.r < n2.r OR (n1.r = n2.r AND n1.c < n2.c))
              AND (n1.r, n1.c) NOT IN (VALUES (1,2), (12,20), (130,126), (141,140))
        )
        FROM nodes n2
        WHERE (r, c) NOT IN (VALUES (1,2), (12,20), (130,126), (141,140))
    ),

    longest(r INT, c INT, d INT, v BIGINT) AS (
        SELECT r, c, MAX(d), v
        FROM (
            SELECT 12 r, 20 c, 0 d, 0 v
            UNION ALL
            SELECT r2, c2, longest.d + links.d, v + (1::BIGINT << internal.id)
            FROM longest, links, internal
            WHERE longest.r = links.r1
              AND longest.c = links.c1
              AND links.r2 = internal.r
              AND links.c2 = internal.c
              AND ((v >> internal.id) % 2) != 1
        )
        GROUP BY r, c, v
    ),

    potato(x INT) AS ( SELECT 1 )

SELECT * FROM longest ORDER BY d DESC;