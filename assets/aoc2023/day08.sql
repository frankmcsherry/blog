WITH MUTUALLY RECURSIVE

        route(step TEXT, steps INT) AS (
            SELECT substring(input, steps, 1), steps
            FROM steps_input, generate_series(1, length(input)) steps
        ),

        -- Part 1: Start at 'AAA` and go until `ZZZ`.
        pos1(state TEXT, steps INT) AS (
            SELECT 'AAA', 0
            UNION ALL
            SELECT 
                CASE WHEN route.step = 'L' THEN paths.left
                     WHEN route.step = 'R' THEN paths.right
                     ELSE '???'
                END,
                pos1.steps + 1
            FROM paths, pos1, route
            WHERE pos1.state = paths.state
              AND 1 + (pos1.steps % 263) = route.steps
              AND pos1.state != 'ZZZ'
              AND pos1.state != '???'
        ),
        part1(part1 INT) AS (SELECT steps FROM pos1 WHERE pos1.state = 'ZZZ'),

        -- Part 2: Start at all '**A` and go until all at '**Z'
        pos2(start TEXT, state TEXT, steps INT) AS (
            SELECT state, state, 0
            FROM paths 
            WHERE substring(state, 3, 1) = 'A'
            UNION ALL
            SELECT 
                pos2.start,
                CASE WHEN route.step = 'L' THEN paths.left
                     WHEN route.step = 'R' THEN paths.right
                     ELSE '???'
                END,
                pos2.steps + 1
            FROM paths, pos2, route
            WHERE pos2.state = paths.state
              AND 1 + (pos2.steps % 263) = route.steps
              AND substring(pos2.state, 3, 1) != 'Z'
        )

    SELECT * FROM pos2 WHERE substring(state, 3, 1) = 'Z';