WITH MUTUALLY RECURSIVE

    lines(r INT, characters TEXT, springs TEXT) AS (
        SELECT
            row_id,
            regexp_split_to_array(regexp_split_to_array(input, '\n')[row_id], ' ')[1] || '.',
            regexp_split_to_array(regexp_split_to_array(input, '\n')[row_id], ' ')[2]
        FROM 
            input,
            generate_series(1, array_length(regexp_split_to_array(input, '\n'), 1)) row_id
    ),
    characters(r INT, pos INT, symb TEXT) AS (
        SELECT
            r,
            pos,
            substring(characters, pos, 1)
        FROM
            lines,
            generate_series(1, length(characters)) pos
    ),
    springs(r INT, pos INT, len INT) AS (
        SELECT
            r,
            pos,
            regexp_split_to_array(springs, ',')[pos]::INT
        FROM
            lines,
            generate_series(1, array_length(regexp_split_to_array(springs, ','), 1)) pos
    ),

    -- How many ways can we pack row `r`'s first `spring` springs (plus a space) into the first `chars` characters?
    -- Importantly, the "plus a space" applies to the last spring also! Each of these should admit the immediate appending of a new spring.
    fits(r INT, chars INT, spring INT) AS (
        -- We can pack no springs into no characters.
        SELECT r, 0, 0
        FROM lines
        -- We can extend any fits with a blank, as long as there are no '#' observations.
        UNION ALL
        SELECT fits.r, fits.chars + 1, fits.spring
        FROM fits, characters
        WHERE fits.r = characters.r
          AND fits.chars + 1 = characters.pos
          AND characters.symb != '#'
        -- We can extend any fits with the next spring and a blank, as long as no '.' in the spring and no '#' in the blank.
        UNION ALL
        SELECT fits.r, fits.chars + springs.len + 1, fits.spring + 1
        FROM
            fits,
            springs,
            characters
        WHERE fits.r = springs.r
          AND fits.spring + 1 = springs.pos
          AND fits.r = characters.r
          AND fits.chars + springs.len + 1 = characters.pos
          AND characters.symb != '#'
          AND NOT EXISTS (SELECT FROM characters c WHERE c.r = fits.r AND c.symb = '.' AND c.pos BETWEEN fits.chars + 1 AND fits.chars + springs.len)
    ),

    fit_counts(r INT, chars INT, spring INT, count BIGINT) AS (
        SELECT r, chars, spring, COUNT(*) AS count
        FROM fits
        GROUP BY r, chars, spring
    ),
    counts(r INT, chars INT, spring INT, count BIGINT) AS (
        SELECT DISTINCT ON (r) r, chars, spring, count
        FROM fit_counts
        ORDER BY r, chars DESC, spring DESC
    ),

    potato (x INT) AS ( SELECT 1 )

SELECT SUM(count) FROM counts;
