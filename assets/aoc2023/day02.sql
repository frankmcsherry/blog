-- Pre-supposes a view `input(input TEXT)` containing the string from AOC
with mutually recursive
    -- Parse the input up 
    lines(line TEXT) as (select regexp_split_to_table(input, '\n') as line from input),
    games(game TEXT, report TEXT) as (select regexp_split_to_array(line, ':')[1], regexp_split_to_array(line, ':')[2] from lines),
    round(game TEXT, visible TEXT) as (select game, regexp_split_to_table(report, ';') from games),
    bacon(game TEXT, color TEXT) as (select game, regexp_split_to_table(visible, ',') from round),
    parsed(game INT, color TEXT, number INT) as (
        select 
            substring(game, 5)::INT as game,
            regexp_split_to_array(color, ' ')[3] as color,
            regexp_split_to_array(color, ' ')[2]::INT as number
        from bacon
    ),
    -- PART 1
    limits(color TEXT, number INT) as (SELECT * FROM (VALUES ('red', 12), ('green', 13), ('blue', 14))),
    bad_news(game INT) as (
        select game 
        from parsed, limits 
        where parsed.color = limits.color 
          AND parsed.number > limits.number
    ),
    plausible(game INT) as (select distinct parsed.game from parsed left join bad_news on(parsed.game = bad_news.game) where bad_news.game IS NULL),
    part1(part1 BIGINT) as (select SUM(game) from plausible),
    -- PART 2
    maximum(game INT, color TEXT, number INT) as (select game, color, max(number) from parsed GROUP BY game, color),
    red(game INT) as (select game from maximum, generate_series(1, number) where color = 'red'),
    blue(game INT) as (select game from maximum, generate_series(1, number) where color = 'blue'),
    green(game INT) as (select game from maximum, generate_series(1, number) where color = 'green'),
    power(game INT, product BIGINT) as (SELECT red.game, count(*) from red, blue, green where red.game = blue.game and blue.game = green.game GROUP BY red.game),
    part2(part2 BIGINT) as (select sum(product)::BIGINT from power)
select * from part1, part2;