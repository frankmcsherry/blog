WITH MUTUALLY RECURSIVE (RETURN AT RECURSION LIMIT 10)

        strings(r INT, string TEXT) AS (
            SELECT r, regexp_split_to_array(input, ',')[r]
            FROM input, generate_series(1, array_length(regexp_split_to_array(input, ','), 1)) r
        ),

        -- Advance the hash by one character, until all strings are empty.
        hashes(string TEXT, hash BIGINT) AS (
            SELECT string, 0 as hash
            FROM strings
            UNION ALL
            SELECT substring(string, 2), ((hash + ascii(substring(string, 1, 1))) * 17) % 256
            FROM hashes
            WHERE length(string) > 0
        ),

        part1(part1 BIGINT) AS (
            SELECT SUM(hash)
            FROM hashes
            WHERE string = ''
        ),

        -- Parse strings as symbol plus commands; either `-` or `=X`.
        commands(r INT, symb TEXT, op INT) AS (
            SELECT 
                r,
                CASE WHEN substring(string, length(string)) = '-' 
                     THEN substring(string, 1, length(string)-1) 
                     ELSE substring(string, 1, length(string)-2)
                END,
                CASE WHEN substring(string, length(string)) = '-' 
                     THEN 0
                     ELSE substring(string, length(string))::INT
                END
            FROM strings
        ),
        -- Operations that happen after a symbol's last delete operation.
        -- All other operations do not matter, and do not affect the state.
        final_ops(r INT, symb TEXT, op INT) AS (
            SELECT * 
            FROM commands
            WHERE r > COALESCE(
                (SELECT MAX(r) 
                FROM commands c2 
                WHERE commands.symb = c2.symb 
                  AND c2.op = 0), 0)
        ),
        -- Each symbol is summarized by their first final insert time, and the last final operation
        final_state(r INT, symb TEXT, op INT) AS (
            SELECT DISTINCT ON(symb) 
                (SELECT MIN(r) FROM final_ops fo2 WHERE fo2.symb = final_ops.symb),
                symb,
                op
            FROM final_ops
            ORDER BY symb, r DESC, op
        ),
        -- Redo the hash computation on symbols rather than commands.
        hashes2(start TEXT, string TEXT, hash BIGINT) AS (
            SELECT symb as start, symb as string, 0 as hash
            FROM final_state
            UNION ALL
            SELECT start, substring(string, 2), ((hash + ascii(substring(string, 1, 1))) * 17) % 256
            FROM hashes2
            WHERE length(string) > 0
        ),
        -- Bin up the state, so's we can tabulate it
        binned(hash BIGINT, r INT, symb TEXT, op INT) AS (
            SELECT hash, final_state.*
            FROM hashes2, final_state
            WHERE hashes2.start = symb
              AND hashes2.string = ''
        ),
        -- Sum the product of 1 + hash, the position in bin by r, and the op.
        part2(part2 BIGINT) AS (
            SELECT SUM(
                (1 + hash) *
                (SELECT COUNT(*) FROM binned b2 WHERE binned.hash = b2.hash AND binned.r >= b2.r) *
                op
            )
            FROM binned
        ),

        potato(x int) as (select 1)

    SELECT * FROM part1, part2;