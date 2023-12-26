WITH MUTUALLY RECURSIVE

        lines(r INT, line TEXT) AS (
            SELECT r, regexp_split_to_array(input, '\n')[r] as block
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
        ),
        cells(r INT, c INT, symbol TEXT) AS (
            SELECT r, c, substring(line, c, 1)
            FROM lines, generate_series(1, length(line)) c
        ),

        northward(r INT, c INT, symbol TEXT) AS (
            SELECT * FROM northward
            -- Anyone on the move does so
            UNION  ALL SELECT r - 1, c, 'O' FROM north_move
            EXCEPT ALL SELECT r - 1, c, '.' FROM north_move
            UNION  ALL SELECT r, c, '.' FROM north_move
            EXCEPT ALL SELECT r, c, 'O' FROM north_move
            -- Initial state is cells, but not refreshed each round.
            UNION  ALL SELECT * FROM cells
            EXCEPT ALL SELECT * FROM cells_delay
        ),

        -- Each 'O' with a '.' to the north will move. 
        north_move(r INT, c INT) AS (
            SELECT n1.r, n1.c
            FROM northward n1, northward n2
            WHERE n1.symbol = 'O'
              AND n1.r = n2.r + 1
              AND n1.c = n2.c
              AND n2.symbol = '.'
        ),

        part1(part1 BIGINT) AS (
            SELECT SUM(1 + (SELECT MAX(r) FROM lines) - r)
            FROM northward
            WHERE symbol = 'O'
        ),

        output (r INT, line TEXT) AS (
            SELECT r, string_agg(symbol, ' ' ORDER BY c)
            FROM northward
            GROUP BY r
        ),

        cells_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM cells )

    SELECT * FROM part1;

    WITH MUTUALLY RECURSIVE (RETURN AT RECURSION LIMIT 142)

        lines(r INT, line TEXT) AS (
            SELECT r, regexp_split_to_array(input, '\n')[r] as block
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
        ),
        cells(r INT, c INT, symbol TEXT) AS (
            SELECT r, c, substring(line, c, 1)
            FROM lines, generate_series(1, length(line)) c
        ),

        -- Where should we start each iteration from? 
        -- From `east`, once it exits, but initially `cells`.
        round(r INT, c INT, symbol TEXT) AS (
            SELECT * FROM east
            UNION  ALL SELECT * FROM cells
            EXCEPT ALL SELECT * FROM cells_delay
        ),

        north(r INT, c INT, symbol TEXT) AS (
            WITH MUTUALLY RECURSIVE 
                start(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM round
                ),
                northward(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM northward
                    -- Anyone on the move does so
                    UNION  ALL SELECT r - 1, c, 'O' FROM north_move
                    EXCEPT ALL SELECT r - 1, c, '.' FROM north_move
                    UNION  ALL SELECT r, c, '.' FROM north_move
                    EXCEPT ALL SELECT r, c, 'O' FROM north_move
                    -- Second time around, the above cancels and `east` is non-empty.
                    UNION  ALL SELECT * FROM start
                    EXCEPT ALL SELECT * FROM start_delay
                ),
                -- Each 'O' with a '.' in front of them will move. 
                north_move(r INT, c INT) AS (
                    SELECT n1.r, n1.c
                    FROM northward n1, northward n2
                    WHERE n1.symbol = 'O'
                    AND n1.r = n2.r + 1
                    AND n1.c = n2.c
                    AND n2.symbol = '.'
                ),
                start_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM start )

            SELECT * FROM northward
        ),
        
         west(r INT, c INT, symbol TEXT) AS (
            WITH MUTUALLY RECURSIVE 
                start(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM north
                ),
                westward(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM westward
                    -- Anyone on the move does so
                    UNION  ALL SELECT r, c - 1, 'O' FROM west_move
                    EXCEPT ALL SELECT r, c - 1, '.' FROM west_move
                    UNION  ALL SELECT r, c, '.' FROM west_move
                    EXCEPT ALL SELECT r, c, 'O' FROM west_move
                    -- Initial state is cells, but not refreshed each round.
                    UNION  ALL SELECT * FROM start
                    EXCEPT ALL SELECT * FROM start_delay
                ),
                -- Each 'O' with a '.' in front of them will move. 
                west_move(r INT, c INT) AS (
                    SELECT w1.r, w1.c
                    FROM westward w1, westward w2
                    WHERE w1.symbol = 'O'
                    AND w1.r = w2.r
                    AND w1.c = w2.c + 1
                    AND w2.symbol = '.'
                ),
                start_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM start )

            SELECT * FROM westward
        ),
        
        south(r INT, c INT, symbol TEXT) AS (
            WITH MUTUALLY RECURSIVE 
                start(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM west
                ),
                southward(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM southward
                    -- Anyone on the move does so
                    UNION  ALL SELECT r + 1, c, 'O' FROM south_move
                    EXCEPT ALL SELECT r + 1, c, '.' FROM south_move
                    UNION  ALL SELECT r, c, '.' FROM south_move
                    EXCEPT ALL SELECT r, c, 'O' FROM south_move
                    -- Initial state is cells, but not refreshed each round.
                    UNION  ALL SELECT * FROM start
                    EXCEPT ALL SELECT * FROM start_delay
                ),
                -- Each 'O' with a '.' in front of them will move. 
                south_move(r INT, c INT) AS (
                    SELECT s1.r, s1.c
                    FROM southward s1, southward s2
                    WHERE s1.symbol = 'O'
                    AND s1.r = s2.r - 1
                    AND s1.c = s2.c
                    AND s2.symbol = '.'
                ),
                start_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM start )
            SELECT * FROM southward
        ),
        
        east(r INT, c INT, symbol TEXT) AS (
            WITH MUTUALLY RECURSIVE 
                start(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM south
                ),
                eastward(r INT, c INT, symbol TEXT) AS (
                    SELECT * FROM eastward
                    -- Anyone on the move does so
                    UNION  ALL SELECT r, c + 1, 'O' FROM east_move
                    EXCEPT ALL SELECT r, c + 1, '.' FROM east_move
                    UNION  ALL SELECT r, c, '.' FROM east_move
                    EXCEPT ALL SELECT r, c, 'O' FROM east_move
                    -- Initial state is cells, but not refreshed each round.
                    UNION  ALL SELECT * FROM start
                    EXCEPT ALL SELECT * FROM start_delay
                ),
                -- Each 'O' with a '.' in front of them will move. 
                east_move(r INT, c INT) AS (
                    SELECT e1.r, e1.c
                    FROM eastward e1, eastward e2
                    WHERE e1.symbol = 'O'
                    AND e1.r = e2.r
                    AND e1.c = e2.c - 1
                    AND e2.symbol = '.'
                ),
                start_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM start )
            SELECT * FROM eastward
        ),

        output (r INT, line TEXT) AS (
            SELECT r, string_agg(symbol, ' ' ORDER BY c)
            FROM round
            GROUP BY r
        ),

        transitions(source TEXT, target TEXT) AS (
            SELECT 
                (SELECT string_agg(symbol, '' ORDER BY r, c) FROM round),
                (SELECT string_agg(symbol, '' ORDER BY r, c) FROM east)
            UNION ALL
            SELECT * FROM transitions
        ),

        part2(part2 BIGINT) AS (
            SELECT SUM(1 + (SELECT MAX(r) FROM lines) - r)
            FROM east
            WHERE symbol = 'O'
        ),

        cells_delay(r INT, c INT, symbol TEXT) AS ( SELECT * FROM cells )

    -- SELECT count, COUNT(*) 
    -- FROM (
    --     SELECT source, target, COUNT(*) count 
    --     FROM transitions 
    --     GROUP BY source, target) 
    -- GROUP BY count;
    
    -- SELECT * FROM output ORDER BY r;

    SELECT * FROM part2;