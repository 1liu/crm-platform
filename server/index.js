require('dotenv/config');
const express = require('express');

const db = require('./database');
const ClientError = require('./client-error');
const staticMiddleware = require('./static-middleware');
const sessionMiddleware = require('./session-middleware');

const app = express();

app.use(staticMiddleware);
app.use(sessionMiddleware);

app.use(express.json());

app.post('/api/login', (req, res, next) => {
  const { email, password } = req.body;

  if (email.trim() === '' || password.trim() === '') {
    return next(new ClientError('Email and Password are required', 400));
  }

  const sql = `
    select "userId"
      from "users"
     where "email" = $1 and "password" = $2
  `;
  const params = [email, password];
  db.query(sql, params)
    .then(result => {
      const userId = result.rows[0];
      if (!userId) {
        throw new ClientError('No userId found', 404);
      } else {
        res.json(userId);
      }
    })
    .catch(err => next(err));
});

app.get('/api/dashboard/:userId', (req, res, next) => {
  const dashboardResponse = {};
  const params = [req.params.userId];

  const userQuery = `
    select "firstName"
           "addressCity"
      from "users"
     where "userId" = $1
  `;

  db.query(userQuery, params)
    .then(result => {
      dashboardResponse.userName = result.rows;

      const ticketQuery = `
        select "t"."ticketId",
              "t"."description",
              "t"."priority",
              "t"."dueDate",
              "c"."firstName",
              "c"."lastName"
          from "tickets" as "t"
          join "customers" as "c" using ("customerId")
        where "t"."ownerId" = $1
        order by "t"."dueDate" asc
        limit 5;
      `;

      db.query(ticketQuery, params)
        .then(result => {
          const tickets = result.rows;
          if (!tickets.length) {
            next(new ClientError(`There were zero tickets found for userId ${params[0]}`, 404));
          } else {
            dashboardResponse.ticketList = tickets;
            res.json(dashboardResponse);
          }
        })
        .catch(err => next(err));
    })
    .catch(err => next(err));

});

app.use((err, req, res, next) => {
  if (err instanceof ClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({
      error: 'an unexpected error occurred'
    });
  }
});

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port', process.env.PORT);
});
