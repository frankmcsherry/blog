WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as block
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),
    cells(r INT, c INT, symbol TEXT) AS (
        SELECT r, c, substring(line, c, 1)
        FROM lines, generate_series(1, length(line)) c
    ),

    shift(dir TEXT, symbol TEXT, dr INT, dc INT, new_dir TEXT) AS (
        VALUES 
            ('r', '.',  0,  1, 'r'),
            ('r', '-',  0,  1, 'r'),
            ('r', '|',  1,  0, 'd'),
            ('r', '|', -1,  0, 'u'),
            ('r', '/', -1,  0, 'u'),
            ('r', '\',  1,  0, 'd'),
            ('l', '.',  0, -1, 'l'),
            ('l', '-',  0, -1, 'l'),
            ('l', '|',  1,  0, 'd'),
            ('l', '|', -1,  0, 'u'),
            ('l', '/',  1,  0, 'd'),
            ('l', '\', -1,  0, 'u'),
            ('u', '.', -1,  0, 'u'),
            ('u', '-',  0,  1, 'r'),
            ('u', '-',  0, -1, 'l'),
            ('u', '|', -1,  0, 'u'),
            ('u', '/',  0,  1, 'r'),
            ('u', '\',  0, -1, 'l'),
            ('d', '.',  1,  0, 'd'),
            ('d', '-',  0,  1, 'r'),
            ('d', '-',  0, -1, 'l'),
            ('d', '|',  1,  0, 'd'),
            ('d', '/',  0, -1, 'l'),
            ('d', '\',  0,  1, 'r')
    ),

    -- Light is in a location, and has a direction.
    light(r INT, c INT, dir TEXT) AS (
        SELECT 1, 1, 'r'
        UNION 
        SELECT light.r + dr, light.c + dc, new_dir
        FROM light, cells, shift
        WHERE light.r = cells.r
            AND light.c = cells.c
            AND light.dir = shift.dir
            AND cells.symbol = shift.symbol
    ),

    part1(part1 BIGINT) AS (
        SELECT COUNT(*) FROM (
            SELECT DISTINCT light.r, light.c 
            FROM light, cells
            WHERE light.r = cells.r 
                AND light.c = cells.c 
        )
    ),

    -- Light is in a location, a direction, and an origin.
    light2(r INT, c INT, dir TEXT, source TEXT) AS (
        SELECT DISTINCT * FROM (SELECT r, (SELECT MIN(c) FROM cells), 'r', 'r' || r FROM cells) UNION 
        SELECT DISTINCT * FROM (SELECT r, (SELECT MAX(c) FROM cells), 'l', 'l' || r FROM cells) UNION 
        SELECT DISTINCT * FROM (SELECT (SELECT MIN(r) FROM cells), c, 'd', 'd' || c FROM cells) UNION 
        SELECT DISTINCT * FROM (SELECT (SELECT MAX(c) FROM cells), c, 'u', 'u' || c FROM cells) UNION 
        SELECT light2.r + dr, light2.c + dc, new_dir, source
        FROM light2, cells, shift
        WHERE light2.r = cells.r
            AND light2.c = cells.c
            AND light2.dir = shift.dir
            AND cells.symbol = shift.symbol
    ),

    part2(part2 BIGINT) AS (
        SELECT MAX(count) FROM (
            SELECT source, COUNT(*) FROM (
                SELECT DISTINCT light2.r, light2.c, source 
                FROM light2, cells
                WHERE light2.r = cells.r 
                    AND light2.c = cells.c 
            )
            GROUP BY source
        )
    )

SELECT * FROM part1, part2;