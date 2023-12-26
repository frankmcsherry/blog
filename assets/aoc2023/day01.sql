-- According to Slack, I copied someone else's part one, because I didn't understand regexps.

-- Search for leading "numbers"
WITH MUTUALLY RECURSIVE
  -- Text we are still exploring to find the first match
  working(value TEXT, index INT) AS (
    SELECT value, 0 
    FROM value
    UNION ALL
    SELECT working.value, least(index + 1, length(working.value))
    FROM working LEFT JOIN found ON (working.value = found.value) WHERE found.value IS NULL
  ),
  -- Text we have found a leading match in
  found(value TEXT, match INT, round INT) AS (
    SELECT * FROM found
    UNION
      SELECT value, n, index
      FROM working, generate_series(1, 5) as off, numbers
      WHERE substring(value, index, off) = numbers.t
  )
SELECT * FROM found;