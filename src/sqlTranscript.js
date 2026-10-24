// Claude's real answer to the SQL starter question (Christine ran it on claude.ai, 2026-10-23).
// Verbatim; only the formatting the paste dropped is restored, as it appears in her screenshot of the same
// answer: the code fence, inline code for SQL terms, bold labels, bullet markers.
export const SQL_QUESTION = "Write me a SQL query for revenue per customer from paid orders, highest first. Tables: customers(id, name) and orders(id, customer_id, total, status). Customers who haven't bought anything yet should still show up with $0.";

export const SQL_TURNS = [
  {
    user: SQL_QUESTION,
    claude: `Here’s the query. The key detail is putting the \`status\` filter in the \`LEFT JOIN\`’s \`ON\` clause rather than in \`WHERE\`, so customers with no paid orders still appear.

\`\`\`sql
SELECT
    c.id,
    c.name,
    COALESCE(SUM(o.total), 0) AS revenue
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
   AND o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY revenue DESC;
\`\`\`

A few notes:

- **Filter placement:** If you moved \`o.status = 'paid'\` into a \`WHERE\` clause, it would discard the NULL rows from the left join and drop customers with no paid orders, which defeats the purpose.
- **\`COALESCE\`:** \`SUM\` over zero matching rows returns \`NULL\`, so this converts it to \`0\`.
- **Status value:** I assumed paid orders are stored as \`'paid'\`. Adjust the string if yours differs (e.g. \`'PAID'\` or \`'completed'\`).
- **Tie-breaking:** Customers with equal revenue (including all the $0 ones) come back in arbitrary order. If you want stable output, add a secondary sort like \`ORDER BY revenue DESC, c.name\`.`,
  },
];
