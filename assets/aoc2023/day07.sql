 -- Hands of cards (e.g. 'AKJQT') and integer bids.
    WITH MUTUALLY RECURSIVE 
        lines(line TEXT) AS ( SELECT regexp_split_to_table(input, '\n') FROM input ),
        hands(hand TEXT, bid INT) as (
            SELECT regexp_split_to_array(line, ' ')[1],
                   regexp_split_to_array(line, ' ')[2]::INT
            FROM lines
        ),
        cards(hand TEXT, value TEXT, position INT) AS (
            SELECT hand, substring(hand, pos, 1), pos
            FROM hands, generate_series(1, 5) pos
        ),

        -- Part1
        counts(hand TEXT, value TEXT, count INT) AS (
            SELECT hand, value, COUNT(*) 
            FROM cards 
            GROUP BY hand, value
        ),
        ranked(hand TEXT, bid INT, rank INT, score TEXT) AS (
            SELECT 
                hand,
                bid,
                CASE WHEN hand IN (SELECT hand FROM counts WHERE count = 5) THEN 1
                     WHEN hand IN (SELECT hand FROM counts WHERE count = 4) THEN 2
                     WHEN hand IN (SELECT hand FROM counts WHERE count = 3) 
                      AND hand IN (SELECT hand FROM counts WHERE count = 2) THEN 3
                     WHEN hand IN (SELECT hand FROM counts WHERE count = 3) THEN 4
                     WHEN hand IN (SELECT hand FROM (SELECT hand FROM counts WHERE count = 2) GROUP BY hand HAVING COUNT(*) = 2) THEN 5
                     WHEN hand IN (SELECT hand FROM counts WHERE count = 2) THEN 6
                     ELSE 7
                END,
                translate(hand, 'AKQJT98765432', 'ABCDEFGHIJKLM')
            FROM
                hands
        ),
        part1(part1 INT) AS (
            SELECT SUM(r1.bid)
            FROM ranked r1, ranked r2
            WHERE r1.rank < r2.rank OR (r1.rank = r2.rank AND r1.score <= r2.score)
        ),

        -- Part2: J are now wild for determining rank, but last for score.
        wild(hand TEXT, value TEXT, position INT) AS (
            SELECT * FROM cards
            UNION
            SELECT c1.hand, c2.value, c1.position
            FROM cards c1, cards c2
            WHERE c1.hand = c2.hand
              AND c1.value = 'J'
        ),
        wild_hands(hand TEXT, new_hand TEXT) AS (
            SELECT DISTINCT w1.hand, w1.value || w2.value || w3.value || w4.value || w5.value
            FROM (SELECT * FROM wild w1 WHERE position = 1) w1,
                 (SELECT * FROM wild w2 WHERE position = 2) w2,
                 (SELECT * FROM wild w3 WHERE position = 3) w3,
                 (SELECT * FROM wild w4 WHERE position = 4) w4,
                 (SELECT * FROM wild w5 WHERE position = 5) w5
            WHERE w1.hand = w2.hand 
              AND w1.hand = w3.hand 
              AND w1.hand = w4.hand 
              AND w1.hand = w5.hand 
        ),
        wild_cards(hand TEXT, value TEXT, position INT) AS (
            SELECT DISTINCT new_hand, substring(new_hand, pos, 1), pos
            FROM wild_hands, generate_series(1, 5) pos
        ),
        wild_counts(hand TEXT, value TEXT, count INT) AS (
            SELECT hand, value, COUNT(*) 
            FROM wild_cards 
            GROUP BY hand, value
        ),
        wild_ranked(hand TEXT, new_hand TEXT, rank INT, score TEXT) AS (
            SELECT 
                hand,
                new_hand,
                CASE WHEN new_hand IN (SELECT hand FROM wild_counts WHERE count = 5) THEN 1
                     WHEN new_hand IN (SELECT hand FROM wild_counts WHERE count = 4) THEN 2
                     WHEN new_hand IN (SELECT hand FROM wild_counts WHERE count = 3) 
                      AND new_hand IN (SELECT hand FROM wild_counts WHERE count = 2) THEN 3
                     WHEN new_hand IN (SELECT hand FROM wild_counts WHERE count = 3) THEN 4
                     WHEN new_hand IN (SELECT hand FROM (SELECT hand FROM wild_counts WHERE count = 2) GROUP BY hand HAVING COUNT(*) = 2) THEN 5
                     WHEN new_hand IN (SELECT hand FROM wild_counts WHERE count = 2) THEN 6
                     ELSE 7
                END,
                translate(hand, 'AKQT98765432J', 'ABCDEFGHIJKLM')
            FROM
                wild_hands
        ),
        best_hands(hand TEXT, new_hand TEXT, rank INT, score TEXT) AS (
            SELECT DISTINCT ON (hand) hand, new_hand, rank, score
            FROM wild_ranked
            ORDER BY hand, rank, score
        ),
        wild_bids(hand TEXT, bid INT, rank INT, score TEXT) AS (
            SELECT hands.hand, hands.bid, rank, score
            FROM hands, best_hands
            WHERE hands.hand = best_hands.hand
        ),
        part2(part2 INT) AS (
            SELECT SUM(r1.bid)
            FROM wild_bids r1, wild_bids r2
            WHERE r1.rank < r2.rank OR (r1.rank = r2.rank AND r1.score <= r2.score)
        )

    SELECT * FROM part1, part2;