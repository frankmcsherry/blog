WITH MUTUALLY RECURSIVE (RETURN AT RECURSION LIMIT 50)

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as line
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),

    edges(src TEXT, dst TEXT) AS (
        SELECT
            trim(':' FROM regexp_split_to_array(line, ' ')[1]),
            trim(',' FROM regexp_split_to_array(line, ' ')[x])
        FROM
            lines, generate_series(2, array_length(regexp_split_to_array(line, ' '), 1)) x
    ),

    symm(src TEXT, dst TEXT) AS (
        SELECT src, dst FROM edges 
        UNION ALL 
        SELECT dst, src FROM edges
    ),

    init(src TEXT, val NUMERIC) AS (
        SELECT src, CASE WHEN src < 'n' THEN 1.0 ELSE -1.0 END
        FROM (SELECT src FROM edges UNION ALL SELECT dst FROM edges)
    ),
    -- determine the second eigenvector of the adjacency matrix
    weight(src TEXT, val NUMERIC) AS (
        SELECT * FROM init
        EXCEPT ALL
        SELECT * FROM init_delayed
        UNION ALL
        SELECT symm.src, SUM((val - (SELECT AVG(val) FROM weight))/(SELECT STDDEV(val) FROM weight))
        FROM symm, weight
        WHERE symm.dst = weight.src
        GROUP BY symm.src
    ),

    init_delayed(src TEXT, val NUMERIC) AS ( SELECT * FROM init ),

    part1(part1 BIGINT) AS (
        SELECT 
            (SELECT COUNT(*) FROM weight WHERE val < 0.0) *
            (SELECT COUNT(*) FROM weight WHERE val > 0.0)
    ),

    potato(x INT) AS ( SELECT 1 )

SELECT * FROM part1;