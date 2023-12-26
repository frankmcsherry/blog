-- Pre-supposes a view `input(input TEXT)` containing the string FROM AOC
    WITH MUTUALLY RECURSIVE
        -- PART 0
        -- Parse the input as lines of text with line numbers.
        lines(line TEXT, row_idx INT) AS ( 
            SELECT 
               regexp_split_to_array(input, '\n')[row_idx],
               row_idx
             FROM 
                input, 
                generate_series(1, (SELECT COUNT(*)::INT FROM (SELECT regexp_split_to_table(input, '\n') FROM input))) as row_idx
        ),
        chars(symbol TEXT, row_idx INT, col_idx INT) AS (
            SELECT 
                substring(line, start, 1),
                row_idx,
                start
            FROM
                lines,
                generate_series(1, length(line)) as start
            WHERE
                substring(line, start, 1) != '.'
        ),
        numerals(number TEXT, row_idx INT, col_idx INT) AS (
            SELECT symbol, row_idx, col_idx 
            FROM chars
            WHERE symbol IN ( VALUES ('0'), ('1'), ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8'), ('9') )
        ),
        symbols(symbol TEXT, row_idx INT, col_idx INT) AS (
            SELECT symbol, row_idx, col_idx 
            FROM chars
            WHERE symbol NOT IN ( VALUES ('0'), ('1'), ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8'), ('9') )
        ),
        -- PART 1
        -- Recursively build up ranges of numerals that are "active", in the sense of being adjacent to a symbol.
        -- Each range has an accumulated number (as a string), a row index, a column index and length of the run.
        active(number TEXT, row_idx INT, col_idx INT, length INT) AS (
            -- Base case: numerals adjacent to a symbol
            SELECT numerals.*, 1
            FROM 
                numerals,
                symbols,
                generate_series(-1, 1) row_off,
                generate_series(-1, 1) col_off
            WHERE numerals.row_idx = symbols.row_idx + row_off 
              AND numerals.col_idx = symbols.col_idx + col_off
            UNION
            -- Inductive case 1: Join to the left
            SELECT numerals.number || active.number, numerals.row_idx, numerals.col_idx, active.length + 1
            FROM numerals, active
            WHERE numerals.row_idx = active.row_idx
              AND numerals.col_idx = active.col_idx - 1
            UNION
            -- Inductive case 2: Join to the right
            SELECT active.number || numerals.number, numerals.row_idx, active.col_idx, active.length + 1
            FROM numerals, active
            WHERE numerals.row_idx = active.row_idx
              AND numerals.col_idx = active.col_idx + active.length
        ),
        parts(number INT, row_idx INT, col_idx INT, length INT) AS (
            SELECT active.number::INT, row_idx, col_idx, length
            FROM active
            WHERE (active.row_idx, active.col_idx-1) NOT IN (SELECT row_idx, col_idx FROM numerals)
              AND (active.row_idx, active.col_idx+length) NOT IN (SELECT row_idx, col_idx FROM numerals)
        ),
        part1(part1 BIGINT) AS ( SELECT SUM(parts.number::INT) FROM parts ),
        -- PART 2
        -- A "gear" is a `*` adjacent to exactly two part numbers. We want the sum over gears of their product.
        -- A gear is identified by a location, which we will want to attempt to join with part numbers.
        gear_adjacent(row_idx INT, col_idx INT, number INT, part_row INT, part_col INT) AS (
            SELECT DISTINCT symbols.row_idx, symbols.col_idx, parts.number, parts.row_idx, parts.col_idx
            FROM
                symbols,
                generate_series(-1, 1) gear_r_off,
                generate_series(-1, 1) gear_c_off,
                parts,
                generate_series(parts.col_idx, parts.col_idx + parts.length - 1) part_col
            WHERE symbols.symbol = '*'
              AND symbols.row_idx + gear_r_off = parts.row_idx
              AND symbols.col_idx + gear_c_off = part_col
        ),
        gears(row_idx INT, col_idx INT) AS (
            SELECT row_idx, col_idx 
            FROM gear_adjacent 
            GROUP BY row_idx, col_idx
            HAVING COUNT(*) = 2
        ),
        gear_products(row_idx INT, col_idx INT, product INT) AS (
            SELECT DISTINCT gears.row_idx, gears.col_idx, p1.number * p2.number
            FROM gears, gear_adjacent p1, gear_adjacent p2
            WHERE gears.row_idx = p1.row_idx
              AND gears.col_idx = p1.col_idx
              AND gears.row_idx = p2.row_idx
              AND gears.col_idx = p2.col_idx
              AND (p1.part_row != p2.part_row OR p1.part_col != p2.part_col)
        ),
        part2(part2 BIGINT) AS ( SELECT SUM(product) FROM gear_products)

    SELECT * FROM part1, part2;