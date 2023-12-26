WITH MUTUALLY RECURSIVE

    lines(line TEXT) AS ( SELECT regexp_split_to_table(input, '\n') FROM input ),
    links(name TEXT, link TEXT) AS (
        SELECT
            substring(regexp_split_to_array(line, ' ')[1], 2),
            trim(',' FROM regexp_split_to_array(line, ' ')[x])
        FROM
            lines, generate_series(3, array_length(regexp_split_to_array(line, ' '), 1)) x
    ),
    -- One special line has op 'b' and name 'roadcaster'.
    types(op TEXT, name TEXT) AS (
        SELECT
            substring(regexp_split_to_array(line, ' ')[1], 1, 1),
            substring(regexp_split_to_array(line, ' ')[1], 2)
        FROM
            lines
    ),

    -- Part one: simulate 1000 steps of 'broadcaster' being activated with a low pulse.
    -- tally up total low and high pulses, and then multiply.
    -- The state carried across steps are the last-transmitted pulses of each operator.
    -- This should also tell us the final state of the `%` operators.
    -- We'll also need the totals of low and high pulses, so that we can add them up.

    seed(press INT, counter INT) AS (
        SELECT 1, 1
        UNION
        SELECT press, counter - 1
        FROM seed
        WHERE counter > 0
        UNION
        SELECT press + 1, 20
        FROM seed
        WHERE counter = 0
          AND press < 4100
    ),

    -- Emitted pulses after various button presses, in various rounds of resolution.
    pulses(name TEXT, press INT, round INT, pulse TEXT) AS (
        -- One thousand button presses, each followed by rounds of resolution.
        SELECT 'roadcaster', press, 1, 'lo' FROM seed WHERE counter = 0
        UNION ALL SELECT * FROM flip
        UNION ALL SELECT * FROM conj
    ),

    -- Counters; every 'lo' input pulse flips and emits the state.
    flip(name TEXT, press INT, round INT, pulse TEXT) AS (
        -- Each `signal` needs to behave as if all "prior" signals have been processed, ordered by (press, round, source).
        SELECT 
            name, 
            press,
            round + 1, 
            -- Look for the most recently emitted signal, and we'll produce the opposite of that one.
            CASE WHEN (
                    SELECT COUNT(*)
                    FROM signal s1 
                    WHERE s1.target = types.name 
                      AND s1.pulse = 'lo'
                      AND ((s1.press < signal.press) OR 
                           (s1.press = signal.press AND s1.round < signal.round) OR 
                           (s1.press = signal.press AND s1.round = signal.round AND s1.source < signal.source))
                ) % 2 = 0
                THEN 'hi'
                ELSE 'lo'
            END
        FROM signal, types
        WHERE signal.target = types.name
            AND types.op = '%'
            AND signal.pulse = 'lo'
    ),

    -- NAND gates; every input pulse evokes the NAND of most recent inputs.
    conj(name TEXT, press INT, round INT, pulse TEXT) AS (
        SELECT 
            name, 
            press,
            round + 1,
            -- Look for the most recently received signals from each input, 
            -- including this one, and iff all 'hi' then 'lo'.
            CASE WHEN (
                    (SELECT COUNT(*) FROM links WHERE link = types.name)
                    =
                    (SELECT COUNT(*) FROM (
                        SELECT DISTINCT ON (source) source, pulse 
                        FROM signal s1 
                        WHERE s1.target = types.name 
                          AND ((s1.press < signal.press) OR 
                               (s1.press = signal.press AND s1.round < signal.round) OR
                               (s1.press = signal.press AND s1.round = signal.round AND s1.source <= signal.source))
                        OPTIONS (DISTINCT ON INPUT GROUP SIZE = 1000)
                        ORDER BY source, press DESC, round DESC
                    ) 
                    WHERE pulse = 'hi')) 
                 THEN 'lo'
                 ELSE 'hi'
            END
        FROM signal, types
        WHERE signal.target = types.name
            AND types.op = '&'
    ),

    -- A record of a pulse into an operator, from another operator.
    -- We track the source so that '&' operators can make any sense.
    signal(source TEXT, target TEXT, press INT, round INT, pulse TEXT) AS (
        SELECT pulses.name, links.link, pulses.press, pulses.round, pulses.pulse
        FROM pulses, links
        WHERE pulses.name = links.name
          AND pulses.round > 0
    ),

    part1(pulse TEXT, count BIGINT) AS (
        SELECT pulse, count(*) FROM signal GROUP BY pulse
    ),

    potato(x INT) AS (SELECT 1)

SELECT * FROM signal WHERE target = 'cn' AND pulse = 'hi'