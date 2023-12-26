WITH MUTUALLY RECURSIVE

        lines(line TEXT, row_no INT) AS (
            SELECT regexp_split_to_array(input, '\n')[i], i
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) i
        ),

        symbols(symb TEXT, row_no INT, col_no INT) as (
            SELECT substring(line, j, 1), row_no, j
            FROM lines, generate_series(1, length(line)) j
        ),

        -- Each location that is pipe has two neighbors
        edge1(r1 INT, c1 INT, r2 INT, c2 INT) AS (
            SELECT 
                row_no,
                col_no,
                CASE WHEN symb = '-' THEN row_no
                     WHEN symb = '|' THEN row_no - 1
                     WHEN symb = 'F' THEN row_no + 1
                     WHEN symb = 'L' THEN row_no - 1
                     WHEN symb = 'J' THEN row_no
                     WHEN symb = '7' THEN row_no
                     ELSE NULL
                END,
                CASE WHEN symb = '-' THEN col_no - 1
                     WHEN symb = '|' THEN col_no
                     WHEN symb = 'F' THEN col_no
                     WHEN symb = 'L' THEN col_no
                     WHEN symb = 'J' THEN col_no - 1
                     WHEN symb = '7' THEN col_no - 1
                     ELSE NULL
                END
            FROM symbols 
            WHERE symb != '.' AND symb != 'S'
        ),
        edge2(r1 INT, c1 INT, r2 INT, c2 INT) AS (
            SELECT
                row_no, 
                col_no,
                CASE WHEN symb = '-' THEN row_no
                     WHEN symb = '|' THEN row_no + 1
                     WHEN symb = 'F' THEN row_no
                     WHEN symb = 'L' THEN row_no
                     WHEN symb = 'J' THEN row_no - 1
                     WHEN symb = '7' THEN row_no + 1
                     ELSE NULL
                END,
                CASE WHEN symb = '-' THEN col_no + 1
                     WHEN symb = '|' THEN col_no
                     WHEN symb = 'F' THEN col_no + 1
                     WHEN symb = 'L' THEN col_no + 1
                     WHEN symb = 'J' THEN col_no
                     WHEN symb = '7' THEN col_no
                     ELSE NULL
                END
            FROM symbols
            WHERE symb != '.' AND symb != 'S'
        ),
        -- Symmetrized graph
        symm(r1 INT, c1 INT, r2 INT, c2 INT) AS (
            SELECT r1, c1, r2, c2 
            FROM (
                SELECT * FROM edge1
                UNION ALL
                SELECT * FROM edge2
                UNION ALL
                SELECT r2, c2, r1, c1 FROM edge1
                UNION ALL
                SELECT r2, c2, r1, c1 FROM edge2
                UNION ALL
                SELECT row_no, col_no, row_no + 1, col_no FROM symbols WHERE symb = 'S'
                UNION ALL
                SELECT row_no, col_no, row_no, col_no + 1 FROM symbols WHERE symb = 'S'
                UNION ALL
                SELECT row_no, col_no, row_no - 1, col_no FROM symbols WHERE symb = 'S'
                UNION ALL
                SELECT row_no, col_no, row_no, col_no - 1 FROM symbols WHERE symb = 'S'
            )
            GROUP BY r1, c1, r2, c2
            HAVING COUNT(*) = 2
        ),
        reach(r INT, c INT) AS (
            SELECT row_no, col_no
            FROM symbols
            WHERE symb = 'S'
            UNION
            SELECT r2, c2
            FROM reach, symm
            WHERE r = r1 AND c = c1
        ),
        part1(part1 BIGINT) AS (
            SELECT COUNT(*)/2 FROM reach
        ),

        -- Part 2: how many cells are *inside* the loop?
        -- All (1, *) and (*, 1) cells have their upper left outside the loop (outer edge of the diagram).
        -- Each cell inherits from its UL neighbor, toggled by any pipe except '7' and 'L' pipe.
        -- Rewrite the pipe to have symbols, and resolve 'S' to actual oriented pipe.
        pipe(r INT, c INT, symb TEXT) AS (
            SELECT r, c, symb
            FROM reach, symbols
            WHERE r = row_no AND c = col_no AND symb != 'S'
            UNION
            SELECT 
                row_no, 
                col_no,
                CASE WHEN row_no = s1.r1 AND col_no = s1.c1 + 1 AND row_no = s2.r2 + 1 AND col_no = s2.c2 THEN 'J' -- toggle
                     WHEN row_no = s1.r1 AND col_no = s1.c1 + 1 AND row_no = s2.r2 AND col_no = s2.c2 - 1 THEN '-' -- toggle
                     WHEN row_no = s1.r1 AND col_no = s1.c1 + 1 AND row_no = s2.r2 - 1 AND col_no = s2.c2 THEN '7' -- no toggle
                     WHEN row_no = s1.r1 + 1 AND col_no = s1.c1 AND row_no = s2.r2 AND col_no = s2.c2 - 1 THEN 'L' -- no toggle
                     WHEN row_no = s1.r1 + 1 AND col_no = s1.c1 AND row_no = s2.r2 - 1 AND col_no = s2.c2 THEN '|' -- toggle
                     WHEN row_no = s1.r1 AND col_no = s1.c1 - 1 AND row_no = s2.r2 AND col_no = s2.c2 - 1 THEN 'F' -- toggle
                     ELSE '???'
                END
            FROM symbols, symm s1, symm s2
            WHERE symb = 'S'
              AND row_no = s1.r1
              AND col_no = s1.c1
              AND row_no = s2.r1
              AND col_no = s2.c1
        ),
        -- Enclosed(1,*) and Enclosed(*,1) are all false.
        -- Enclosed(x+1,y+1) = Enclosed(x,y) perhaps toggled by pipe(x,y)
        status(r INT, c INT, encl BOOL) AS (
            SELECT row_no, col_no, false
            FROM symbols
            WHERE row_no = 1 OR col_no = 1
            UNION
            SELECT 
                row_no + 1,
                col_no + 1,
                CASE WHEN pipe.symb IN (VALUES ('J'),('-'),('|'),('F')) THEN NOT encl
                     ELSE encl
                END
            FROM status LEFT JOIN pipe ON (status.r = pipe.r AND status.c = pipe.c)
            JOIN symbols ON (status.r = symbols.row_no AND status.c = symbols.col_no)
        ),
        part2(part2 BIGINT) AS (
            SELECT COUNT(*)
            FROM status
            WHERE encl = true AND (r, c) NOT IN (SELECT r, c FROM pipe)
        )

    SELECT * FROM part1, part2;