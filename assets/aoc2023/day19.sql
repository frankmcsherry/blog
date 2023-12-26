WITH MUTUALLY RECURSIVE 

    blocks(block1 TEXT, block2 TEXT) AS (
        SELECT
            regexp_split_to_array(input, '\n\n')[1] block1,
            regexp_split_to_array(input, '\n\n')[2] block2
        FROM input
    ),
    states(state TEXT, trans TEXT) AS (
        SELECT 
            regexp_split_to_array(line, '\{')[1] state,  
            trim('}' FROM regexp_split_to_array(line, '\{')[2]) trans
        FROM (SELECT regexp_split_to_table(block1, '\n') line FROM blocks)
    ),
    steps(state TEXT, priority INT, rule TEXT) AS (
        SELECT
            state, 
            priority,
            regexp_split_to_array(trans, ',')[priority]
        FROM states, generate_series(1, array_length(regexp_split_to_array(trans, ','), 1)) priority
    ),

    starts(x INT, m INT, a INT, s INT) AS (
        SELECT 
            substring(regexp_split_to_array(trimmed, ',')[1], 3)::INT,
            substring(regexp_split_to_array(trimmed, ',')[2], 3)::INT,
            substring(regexp_split_to_array(trimmed, ',')[3], 3)::INT,
            substring(regexp_split_to_array(trimmed, ',')[4], 3)::INT
        FROM (SELECT trim('\{' FROM trim('\}' FROM regexp_split_to_table(block2, '\n'))) trimmed FROM blocks)
    ),

    --
    rules(state TEXT, priority INT, field TEXT, cmp TEXT, val INT, next TEXT) AS (
        SELECT
            state,
            priority,
            CASE WHEN substring(rule, 2, 1) = '<' OR substring(rule, 2, 1) = '>'
                THEN substring(rule, 1, 1)
                ELSE 'x'
            END,
            CASE WHEN substring(rule, 2, 1) = '<' OR substring(rule, 2, 1) = '>'
                THEN substring(rule, 2, 1)
                ELSE '>'
            END,
            CASE WHEN substring(rule, 2, 1) = '<' OR substring(rule, 2, 1) = '>'
                THEN regexp_split_to_array(substring(rule, 3), ':')[1]::INT
                ELSE '0'
            END,
            CASE WHEN substring(rule, 2, 1) = '<' OR substring(rule, 2, 1) = '>'
                THEN regexp_split_to_array(substring(rule, 3), ':')[2]
                ELSE rule
            END
        FROM steps
    ),

    -- PART 1: iterate folks forward from `in`
    movement(state TEXT, x INT, m INT, a INT, s INT) AS (
        SELECT 'in' state, * FROM starts
        UNION ALL
        SELECT next, x, m, a, s 
        FROM (
            SELECT DISTINCT ON (state, x, m, a, s) state, x, m, a, s, priority, next
            FROM (
                SELECT movement.*, rules.next, rules.priority 
                FROM movement, rules
                WHERE movement.state = rules.state
                AND CASE WHEN rules.cmp = '<' 
                         THEN CASE WHEN rules.field = 'x' THEN x < val
                                   WHEN rules.field = 'm' THEN m < val
                                   WHEN rules.field = 'a' THEN a < val
                                   WHEN rules.field = 's' THEN s < val
                                   ELSE false
                              END
                         WHEN rules.cmp = '>' 
                         THEN CASE WHEN rules.field = 'x' THEN x > val
                                   WHEN rules.field = 'm' THEN m > val
                                   WHEN rules.field = 'a' THEN a > val
                                   WHEN rules.field = 's' THEN s > val
                                   ELSE false
                              END
                         ELSE false
                    END                  
            )
            ORDER BY state, x, m, a, s, priority
        )
    ),

    part1(part1 BIGINT) AS (
        SELECT SUM(x + m + a + s)
        FROM movement
        WHERE state = 'A'
    ),

    -- PART 2: just find all the bounding regions and label them 'A' or 'R'.
    region(state TEXT, priority INT, xl INT, xu INT, ml INT, mu INT, al INT, au INT, sl INT, su INT) AS (
        SELECT 'in', 1, 1, 4000, 1, 4000, 1, 4000, 1, 4000
        -- Could satisfy the rule, and transition to the next state ..
        UNION ALL
        SELECT
            next, 
            1,
            CASE WHEN rules.field = 'x' AND rules.cmp = '>' THEN GREATEST(val+1, xl) ELSE xl END, 
            CASE WHEN rules.field = 'x' AND rules.cmp = '<' THEN LEAST(val-1, xu) ELSE xu END, 
            CASE WHEN rules.field = 'm' AND rules.cmp = '>' THEN GREATEST(val+1, ml) ELSE ml END, 
            CASE WHEN rules.field = 'm' AND rules.cmp = '<' THEN LEAST(val-1, mu) ELSE mu END, 
            CASE WHEN rules.field = 'a' AND rules.cmp = '>' THEN GREATEST(val+1, al) ELSE al END, 
            CASE WHEN rules.field = 'a' AND rules.cmp = '<' THEN LEAST(val-1, au) ELSE au END, 
            CASE WHEN rules.field = 's' AND rules.cmp = '>' THEN GREATEST(val+1, sl) ELSE sl END, 
            CASE WHEN rules.field = 's' AND rules.cmp = '<' THEN LEAST(val-1, su) ELSE su END
        FROM region, rules
        WHERE region.state = rules.state
          AND region.priority = rules.priority
        -- .. or could fail the rule, and advance to the next priority.
        UNION ALL
        SELECT
            region.state, 
            region.priority + 1,
            CASE WHEN rules.field = 'x' AND rules.cmp = '<' THEN GREATEST(val, xl) ELSE xl END, 
            CASE WHEN rules.field = 'x' AND rules.cmp = '>' THEN LEAST(val, xu) ELSE xu END, 
            CASE WHEN rules.field = 'm' AND rules.cmp = '<' THEN GREATEST(val, ml) ELSE ml END, 
            CASE WHEN rules.field = 'm' AND rules.cmp = '>' THEN LEAST(val, mu) ELSE mu END, 
            CASE WHEN rules.field = 'a' AND rules.cmp = '<' THEN GREATEST(val, al) ELSE al END, 
            CASE WHEN rules.field = 'a' AND rules.cmp = '>' THEN LEAST(val, au) ELSE au END, 
            CASE WHEN rules.field = 's' AND rules.cmp = '<' THEN GREATEST(val, sl) ELSE sl END, 
            CASE WHEN rules.field = 's' AND rules.cmp = '>' THEN LEAST(val, su) ELSE su END
        FROM region, rules
        WHERE region.state = rules.state
          AND region.priority = rules.priority
    ),

    part2(part2 NUMERIC) AS (
        SELECT SUM((1 + xu - xl)::BIGINT * (1 + mu - ml)::BIGINT * (1 + au - al)::BIGINT * (1 + su - sl)::BIGINT)
        FROM region
        WHERE state = 'A'
    ),

    potato(x INT) AS (SELECT 1)

SELECT * FROM part1, part2;