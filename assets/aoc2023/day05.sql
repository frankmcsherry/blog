WITH MUTUALLY RECURSIVE
    blocks(head TEXT, body TEXT) AS (
        SELECT
            split_part(regexp_split_to_table(input, '\n\n'), ':', 1),
            split_part(regexp_split_to_table(input, '\n\n'), ':', 2)
        FROM
            input
    ),
    seeds(seed BIGINT) AS (
        SELECT regexp_split_to_table(trim(body), ' ')::BIGINT
        FROM blocks
        WHERE head = 'seeds'
    ),
    entry0(src_name TEXT, dst_name TEXT, dst_idx TEXT, src_idx TEXT, len TEXT) AS (
        SELECT
            split_part(split_part(head, ' ', 1), '-', 1),
            split_part(split_part(head, ' ', 1), '-', 3),
            split_part(regexp_split_to_table(body, '\n'), ' ', 1),
            split_part(regexp_split_to_table(body, '\n'), ' ', 2),
            split_part(regexp_split_to_table(body, '\n'), ' ', 3)
        FROM
            blocks
        WHERE
            head != 'seeds'
    ),
    entry(src_name TEXT, dst_name TEXT, src_idx BIGINT, dst_idx BIGINT, len BIGINT) AS (
        SELECT
            src_name,
            dst_name,
            src_idx::BIGINT,
            dst_idx::BIGINT,
            len::BIGINT
        FROM
            entry0
        WHERE
            src_idx != ''
    ),

    -- PART 1
    -- Our active inventory of .. "stuff"
    active(name TEXT, idx BIGINT) AS (
        SELECT 'seed', seed FROM seeds
        UNION ALL
        SELECT
            intent.dst_name,
            COALESCE(intent.idx + (entry.dst_idx - entry.src_idx), idx)
        FROM intent LEFT JOIN entry ON (
            intent.src_name = entry.src_name AND
            intent.dst_name = entry.dst_name AND
            intent.idx BETWEEN entry.src_idx AND entry.src_idx + len - 1)
    ),
    -- We would like to perform this mapping, but must find a range.
    intent(src_name TEXT, dst_name TEXT, idx BIGINT) AS (
        SELECT DISTINCT entry.src_name, dst_name, idx
        FROM active, entry
        WHERE active.name = entry.src_name
    ),
    part1(part1 BIGINT) AS (
        SELECT MIN(idx) FROM active WHERE name = 'location'
    ),

    -- PART 2
    -- Now we are doing *ranges* of seeds, rather than seed identifiers.
    -- They are big ranges, so we'll need to be smarter!
    seeds2(start_idx BIGINT, end_idx BIGINT) AS (
        SELECT
            regexp_split_to_array(trim(body), ' ')[2*x-1]::BIGINT,
            regexp_split_to_array(trim(body), ' ')[2*x-1]::BIGINT + regexp_split_to_array(trim(body), ' ')[2*x]::BIGINT
        FROM
            blocks,
            generate_series(1, array_length(regexp_split_to_array(trim(body), ' '), 1)/2) x
        WHERE head = 'seeds'
    ),
    active2(name TEXT, start_idx BIGINT, end_idx BIGINT) AS (
        SELECT 'seed', start_idx, end_idx
        FROM seeds2
        UNION
        SELECT 
            dst_name, 
            clipped_start + (entry_dst - entry_start),
            clipped_end   + (entry_dst - entry_start)
        FROM intersection
        UNION
        SELECT 
            name, 
            start_idx,
            end_idx
        FROM hole
    ),
    -- We would like to perform this mapping, but must find a range.
    intent2(src_name TEXT, dst_name TEXT, start_idx BIGINT, end_idx BIGINT) AS (
        SELECT DISTINCT entry.src_name, dst_name, start_idx, end_idx
        FROM active2, entry
        WHERE active2.name = entry.src_name
    ),
    -- Each mapping has a potential intersection with a requested range.
    intersection(src_name TEXT, dst_name TEXT, start_idx BIGINT, end_idx BIGINT, entry_start BIGINT, entry_end BIGINT, clipped_start BIGINT, clipped_end BIGINT, entry_dst BIGINT) AS (
        SELECT
            intent2.src_name,
            intent2.dst_name,
            intent2.start_idx,
            intent2.end_idx,
            entry.src_idx,
            entry.src_idx + entry.len,
            GREATEST(start_idx, entry.src_idx),
            LEAST(end_idx, entry.src_idx + entry.len),
            entry.dst_idx
        FROM intent2, entry
        WHERE intent2.src_name = entry.src_name 
          AND intent2.dst_name = entry.dst_name
          AND GREATEST(intent2.start_idx, entry.src_idx)
            < LEAST(intent2.end_idx, entry.src_idx + entry.len)
    ),
    -- We may have holes in our intervals. Each intersection's start and end is the end and
    -- start, respectively, of some hole we may have that needs to remain the identity.
    hole(name TEXT, start_idx BIGINT, end_idx BIGINT) AS (
        SELECT * FROM (
            SELECT
                dst_name,
                clipped_end start_idx,
                (
                    SELECT COALESCE(MIN(i2.clipped_start), i1.end_idx)
                    FROM intersection i2
                    WHERE i2.clipped_start >= i1.clipped_end
                    AND i2.clipped_start < i1.end_idx
                    AND i1.src_name = i2.src_name
                    AND i1.dst_name = i2.dst_name
                    AND i1.start_idx = i2.start_idx
                    AND i1.end_idx = i2.end_idx
                ) end_idx
            FROM intersection i1
            UNION
            SELECT DISTINCT 
                dst_name, 
                start_idx, 
                (
                    SELECT COALESCE(MIN(i2.clipped_start), i1.end_idx)
                    FROM intersection i2
                    WHERE i2.clipped_start >= i1.start_idx
                    AND i2.clipped_start < i1.end_idx
                    AND i1.src_name = i2.src_name
                    AND i1.dst_name = i2.dst_name
                    AND i1.start_idx = i2.start_idx
                    AND i1.end_idx = i2.end_idx
                )
            FROM intent2 i1
        )
        WHERE start_idx < end_idx
    ),
    part2(part2 BIGINT) AS ( SELECT MIN(start_idx) FROM active2 WHERE name = 'location')

SELECT * FROM part1, part2;