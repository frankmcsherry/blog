WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as block
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),
    cells(r INT, c INT, cost INT) AS (
        SELECT r, c, substring(line, c, 1)::INT
        FROM lines, generate_series(1, length(line)) c
    ),

    -- For each cell, we can be headed n, e, w, s and have gone 1, 2, 3 steps already.
    -- There is a mimimum cost path to reach this configuration, and .. we might need 
    -- to remember how we got there but let's do that in part 2.
    min_cost(r INT, c INT, dr INT, dc INT, steps INT, cost INT) AS (
        SELECT r, c, dr, dc, steps, MIN(cost) 
        FROM (
            SELECT 1 as r, 1 as c, 1 as dr, 0 as dc, 0 as steps, 0 as cost
            UNION ALL
            SELECT 1, 1, 0, 1, 0, 0
            -- We could have just stepped to r, c in a few ways, incurring its cost.
            UNION ALL
            SELECT cells.r, cells.c, dr, dc, steps + 1, min_cost.cost + cells.cost
            FROM min_cost, cells
            WHERE steps < 3
              AND cells.r = min_cost.r + dr
              AND cells.c = min_cost.c + dc
            -- We could take a ??? turn
            UNION ALL
            SELECT cells.r, cells.c, dc, dr, 1, min_cost.cost + cells.cost
            FROM min_cost, cells
            WHERE cells.r = min_cost.r + dc
              AND cells.c = min_cost.c + dr
            -- We could take a ??? turn
            UNION ALL
            SELECT cells.r, cells.c, -dc, -dr, 1, min_cost.cost + cells.cost
            FROM min_cost, cells
            WHERE cells.r = min_cost.r - dc
              AND cells.c = min_cost.c - dr
        )
        GROUP BY r, c, dr, dc, steps
    ),

    part1(part1 INT) AS (
        SELECT MIN(cost)
        FROM min_cost
        WHERE r = (SELECT MAX(r) FROM cells)
          AND c = (SELECT MAX(c) FROM cells)
    ),


 -- For each cell, we can be headed n, e, w, s and have gone 1, 2, 3 steps already.
    -- There is a mimimum cost path to reach this configuration, and .. we might need 
    -- to remember how we got there but let's do that in part 2.
    min_cost2(r INT, c INT, dr INT, dc INT, steps INT, cost INT) AS (
        SELECT r, c, dr, dc, steps, MIN(cost) 
        FROM (
            SELECT 1 as r, 1 as c, 1 as dr, 0 as dc, 0 as steps, 0 as cost
            UNION ALL
            SELECT 1, 1, 0, 1, 0, 0
            -- We could have just stepped to r, c in a few ways, incurring its cost.
            UNION ALL
            SELECT cells.r, cells.c, dr, dc, steps + 1, min_cost2.cost + cells.cost
            FROM min_cost2, cells
            WHERE steps < 10
              AND cells.r = min_cost2.r + dr
              AND cells.c = min_cost2.c + dc
            -- We could take a XYZ turn
            UNION ALL
            SELECT cells.r, cells.c, dc, dr, 1, min_cost2.cost + cells.cost
            FROM min_cost2, cells
            WHERE steps >= 4
              AND cells.r = min_cost2.r + dc
              AND cells.c = min_cost2.c + dr
            -- We could take a ZYX turn
            UNION ALL
            SELECT cells.r, cells.c, -dc, -dr, 1, min_cost2.cost + cells.cost
            FROM min_cost2, cells
            WHERE steps >= 4
              AND cells.r = min_cost2.r - dc
              AND cells.c = min_cost2.c - dr
        )
        GROUP BY r, c, dr, dc, steps
    ),

    part2(part2 INT) AS (
        SELECT MIN(cost)
        FROM min_cost2
        WHERE r = (SELECT MAX(r) FROM cells)
          AND c = (SELECT MAX(c) FROM cells)
          AND steps >= 4
    ),

    potato(x INT) AS (SELECT 1)

SELECT * FROM part1, part2;

