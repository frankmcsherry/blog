-- Pre-supposes a view `input(input TEXT)` containing the string FROM AOC
WITH MUTUALLY RECURSIVE
    -- PART 0
    -- Parse the input as lines of text with line numbers.
    lines(line TEXT) AS ( 
        SELECT regexp_split_to_table(input, '\n')
        FROM   input
    ),
    blocks(card TEXT, wins TEXT, have TEXT) AS (
        SELECT 
            TRIM (regexp_split_to_array(line, '(:|\|)')[1]),
            TRIM (regexp_split_to_array(line, '(:|\|)')[2]),
            TRIM (regexp_split_to_array(line, '(:|\|)')[3])
        FROM   
            lines
    ),
    parsed(card INT, wins TEXT[], have TEXT[]) AS (
        SELECT 
            regexp_match(card, '[0-9]+')[1]::INT,
            regexp_split_to_array(wins, ' '),
            regexp_split_to_array(have, ' ')
        FROM blocks
    ),

    -- PART 1
    -- Count "have"s in "wins" for each row, exponentiate, sum.
    matches(card INT, score BIGINT) AS (
        SELECT card, (
            SELECT COUNT(*) 
            FROM (
                SELECT unnest(wins) w
                INTERSECT
                SELECT unnest(have) w
            )
            WHERE w != ''
        )
        FROM parsed
    ),
    part1(part1 NUMERIC) AS (
        SELECT SUM(pow(2, score - 1))::NUMERIC
        FROM matches
        WHERE score > 0
    ),
    
    -- PART 2
    -- Each card provides a copy of the next `score` cards.
    -- This could be prefix sum if we want to be clever ...
    expanded(card INT, score BIGINT) AS (
        SELECT * FROM matches
        UNION ALL
        SELECT 
            matches.card,
            matches.score
        FROM 
            expanded, 
            matches, 
            generate_series(1, expanded.score) as step
        WHERE
            expanded.card + step = matches.card
    ),
    part2(part2 BIGINT) AS ( SELECT COUNT(*) FROM expanded)

select * from part1, part2;