    WITH MUTUALLY RECURSIVE
    
        ties(slower NUMERIC, faster NUMERIC) AS (
            SELECT 
                (time + sqrt(time * time - 4 * distance)) / 2 as slower,
                (time - sqrt(time * time - 4 * distance)) / 2 as faster
            FROM input
        ),
        options(choices NUMERIC) AS (
            SELECT 1 + FLOOR(slower)::NUMERIC - CEIL(faster)::NUMERIC FROM ties
        ),
        part12(part12 NUMERIC) AS (
            SELECT pow(10.0, SUM(log(choices))) FROM options
        )

    SELECT * FROM part12;