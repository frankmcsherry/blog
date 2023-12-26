WITH MUTUALLY RECURSIVE

    lines(r INT, line TEXT) AS (
        SELECT r, regexp_split_to_array(input, '\n')[r] as line
        FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) r
    ),

    cells(r INT, x INT, y INT, z INT) AS (
        SELECT xs.r, x, y, z
        FROM (SELECT r, generate_series(regexp_split_to_array(regexp_split_to_array(line, '~')[1], ',')[1]::INT, 
                                        regexp_split_to_array(regexp_split_to_array(line, '~')[2], ',')[1]::INT) x FROM lines) xs,
             (SELECT r, generate_series(regexp_split_to_array(regexp_split_to_array(line, '~')[1], ',')[2]::INT, 
                                        regexp_split_to_array(regexp_split_to_array(line, '~')[2], ',')[2]::INT) y FROM lines) ys,
             (SELECT r, generate_series(regexp_split_to_array(regexp_split_to_array(line, '~')[1], ',')[3]::INT, 
                                        regexp_split_to_array(regexp_split_to_array(line, '~')[2], ',')[3]::INT) z FROM lines) zs
        WHERE xs.r = ys.r
          AND xs.r = zs.r
    ),

    -- Part one: let the pieces fall, with a minimum z value of one.
    parts(r INT, x INT, y INT, z INT) AS (
        SELECT * FROM cells
        EXCEPT ALL SELECT * FROM cells_delayed
        UNION ALL
        SELECT r, x, y, CASE WHEN r IN (SELECT * FROM supported) THEN z ELSE z - 1 END
        FROM parts
    ),
    -- One piece supports a *different* piece if it is directly below a piece of the other.
    supports(r1 INT, r2 INT) AS (
        SELECT DISTINCT p1.r, p2.r
        FROM parts p1, parts p2
        WHERE p1.x = p2.x
          AND p1.y = p2.y
          AND p1.z + 1 = p2.z
          AND p1.r != p2.r
    ),
    supported(r INT) AS (
        SELECT r FROM parts WHERE z = 1
        UNION
        SELECT r2 FROM supports
    ),
    -- A piece is safe to remove if it is does not uniquely support any other piece.
    part1(part1 BIGINT) AS (
        SELECT COUNT(DISTINCT r)
        FROM lines 
        WHERE r NOT IN (
            SELECT r1 
            FROM supports 
            WHERE r2 IN (
                SELECT r2 
                FROM supports 
                GROUP BY r2 
                HAVING COUNT(*) = 1
            )
        )
    ),

    cells_delayed(r INT, x INT, y INT, z INT) AS ( SELECT * FROM cells ),

    -- Part two: for each piece, how many pieces would fall if you removed it?
    -- Extend `supports` to transitive support: if r1 vanished would r2 fall?
    supports_trans(r1 INT, r2 INT) AS (
        -- Uniquely supported pieces would certainly fall.
        SELECT * 
        FROM supports
        WHERE r2 IN (SELECT r2 FROM supports GROUP BY r2 HAVING COUNT(*) = 1)
        -- Any piece all of whose supports would fall without 'a' also falls without it.
        UNION
        SELECT st.r1, s1.r2
        FROM supports_trans st, supports s1
        WHERE st.r2 = s1.r1
        GROUP BY st.r1, s1.r2
        HAVING COUNT(*) = (SELECT COUNT(*) FROM supports WHERE supports.r2 = s1.r2)
    ),

    part2(part2 BIGINT) AS (SELECT COUNT(*) FROM supports_trans)

SELECT * FROM part1, part2;