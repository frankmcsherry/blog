WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as line
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),

    observation(r INT, x NUMERIC, y NUMERIC, z NUMERIC, dx NUMERIC, dy NUMERIC, dz NUMERIC) AS (
        SELECT
            r,
            trim(',' FROM regexp_split_to_array(line, ' ')[1])::NUMERIC,
            trim(',' FROM regexp_split_to_array(line, ' ')[2])::NUMERIC,
            trim(',' FROM regexp_split_to_array(line, ' ')[3])::NUMERIC,
            trim(',' FROM regexp_split_to_array(line, ' ')[5])::NUMERIC,
            trim(',' FROM regexp_split_to_array(line, ' ')[6])::NUMERIC,
            trim(',' FROM regexp_split_to_array(line, ' ')[7])::NUMERIC
        FROM
            lines
    ),

    -- Part one: for each pair, solve for a future (x,y) intersection of their traced paths.
    -- https://en.wikipedia.org/wiki/Line–line_intersection#Given_two_points_on_each_line_segment
    meeting(r1 INT, r2 INT, x NUMERIC, y NUMERIC, t1 NUMERIC, t2 NUMERIC) AS (
        SELECT 
            o1.r, 
            o2.r,
            o1.x + o1.dx * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            o1.y + o1.dy * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            (((o2.x - o1.x) * o1.dy) - ((o2.y - o1.y) * o1.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx)
        FROM observation o1, observation o2
        WHERE o1.dx * o2.dy != o1.dy * o2.dx
          AND o1.r < o2.r
    ),
    part1(part1 BIGINT) AS (
        SELECT COUNT(*)
        FROM meeting
        WHERE t1 >= 0
          AND t2 >= 0
          AND x BETWEEN 200000000000000 AND 400000000000000
          AND y BETWEEN 200000000000000 AND 400000000000000
    ),

    -- Part two: find an initial x, y, z, dx, dy, dz such that you intersect every observation in the future.
    -- Hypothesize dx and dy, subtract them, and assses the number of coincidences. 
    hypotheses(r INT, x NUMERIC, y NUMERIC, dx NUMERIC, dy NUMERIC, ox NUMERIC, oy NUMERIC) AS (
        SELECT
            r, x, y, dx - ox, dy - oy, ox, oy
        FROM
            observation, 
            generate_series(-500, 500) ox,
            generate_series(-500, 500) oy
        WHERE r < 10
          AND 5 * (ox + 21) = 16 * (oy + 39)    -- derived from input pair with same (dx, dy).
    ),
    coincidence(r1 INT, r2 INT, x NUMERIC, y NUMERIC, ox NUMERIC, oy NUMERIC) AS (
        SELECT 
            o1.r, 
            o2.r,
            o1.x + o1.dx * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            o1.y + o1.dy * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            o1.ox,
            o1.oy
        FROM hypotheses o1, hypotheses o2
        WHERE o1.dx * o2.dy != o1.dy * o2.dx
          AND o1.r < o2.r
          AND o1.ox = o2.ox
          AND o1.oy = o2.oy
    ),

    hypotheses_xz(r INT, x NUMERIC, y NUMERIC, dx NUMERIC, dy NUMERIC, ox NUMERIC, oy NUMERIC) AS (
        SELECT
            r, x, z, dx - ox, dz - oz, ox, oz
        FROM
            observation, 
            generate_series(-117, -117) ox,
            generate_series(-500, 500) oz
        WHERE r < 10
    ),
    coincidence_xz(r1 INT, r2 INT, x NUMERIC, y NUMERIC, ox NUMERIC, oy NUMERIC) AS (
        SELECT 
            o1.r, 
            o2.r,
            o1.x + o1.dx * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            o1.y + o1.dy * (((o2.x - o1.x) * o2.dy) - ((o2.y - o1.y) * o2.dx)) / (o1.dx * o2.dy - o1.dy * o2.dx),
            o1.ox,
            o1.oy
        FROM hypotheses_xz o1, hypotheses_xz o2
        WHERE o1.dx * o2.dy != o1.dy * o2.dx
          AND o1.r < o2.r
          AND o1.ox = o2.ox
          AND o1.oy = o2.oy
    ),

    potato (x INT) AS ( SELECT 1 )

-- SELECT x, y, ox, oy, COUNT(*) FROM coincidence GROUP BY x, y, ox, oy HAVING COUNT(*) > 1;
SELECT x, y, ox, oy, COUNT(*) FROM coincidence_xz GROUP BY x, y, ox, oy HAVING COUNT(*) > 1;