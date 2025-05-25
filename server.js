const express = require('express');
const bodyParser = require('body-parser');
const db = require('./server_db');
const path = require('path');
const session = require('express-session'); // підключення сесії для збереження параметрів реєстрації

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true })); // Здатен обробляти складні типи html форм
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'html_files'))); // Дає доступ до всіх файлів з папки html_files

app.use(session({ // ! Налаштування параметрів сесії !
    secret: 'mySecretKey', // Секретний ключ для підпису cookie сесії.
    resave: false, // Не зберігати сесію в сховище, якщо вона не змінювалась.
    saveUninitialized: false, //Не створювати сесію, поки нічого не збережено в неї
}));

// Обробка стандартних html запитів та видача відповідних тсорінок до запитів get
app.get('/simulation', (req, res) => {
    res.sendFile(path.join(__dirname, 'html_files', 'sim.html'));
});

app.get('/info', (req, res) => {
    res.sendFile(path.join(__dirname, 'html_files', 'info.html'));
});

// Обробка html запитів реєстрації з включанням логіки щодо облікового запису
app.get('/user', (req, res) => { // html запит на юзера
    if (req.session.user) { // Якщо у цієї сесії вже є ім'я, то виконуємо наступні дії:

        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html'));
        // res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html'));

    } else { // А якщо у сесї імені (ім'я користувача, який зареєструвався) немає...
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'enter.html'));
    }

});

app.get('/enter', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html'));
    } else {
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'enter.html'));
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html'));
    } else {
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'register.html'));
    }
});

// Обробка сигналу на реєстрації (Обробка POST запиту /register)
app.post('/register', (req, res) => {
    const { username, password } = req.body; // задаємо в об'єкт запиту два параметри

    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)'); // Створюємо підготовлений sql запит
    // ? — це місце для безпечної вставки значень (запобігає SQL-інʼєкціям).
    stmt.run(username, password, function (err) { // вставляються значення з перевіркою на помилку
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') { // SQLITE_CONSTRAINT - username вже існує
                return res.send('Ім’я користувача вже зайняте.');
            }
            return res.send('Помилка при реєстрації.');
        }
        req.session.user = { username }; // Сесії присвоюється те ім'я, яке ми зараз ввели при реєстрації
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html')); // Переходимо на основну сторінку
    });
    stmt.finalize(); // Закриття підготовленого запиту
});

// Обробка сигналу на вхід на сторінці enter.html
app.post('/enter', (req, res) => {
    const { username, password } = req.body;

    const stmt = db.prepare('SELECT * FROM users WHERE username = ?'); // Створюємо підготовлений sql запит
    stmt.get(username, (err, row) => {
        if (err) { // Якщо помилка
            console.error(err);
            return res.send('Сталася помилка при вході.');
        }

        if (!row) {
            return res.send('Користувача не знайдено.');
        }

        if (row.password !== password) {
            return res.send('Невірний пароль.');
        }

        req.session.user = { username }; // Сесії присвоюється те ім'я, яке ми зараз ввели при реєстрації
        res.sendFile(path.join(__dirname, 'html_files', 'html_account_part', 'user.html')); // Переходимо на основну сторінку
    });
    stmt.finalize(); // Закриття підготовленого запиту
});

app.post('/save-simulation', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Потрібно увійти в систему.');
    }

    const { volume, speed, density, turbulence, length, thickness } = req.body;
    const username = req.session.user.username;

    // Знаходимо user_id по username
    const getUserStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    getUserStmt.get(username, (err, userRow) => {
        if (err || !userRow) {
            console.error('Помилка пошуку користувача:', err);
            return res.status(500).send('Користувача не знайдено.');
        }

        const user_id = userRow.id;

        // Знаходимо останній номер симуляції
        const getLastSimNumberStmt = db.prepare(
            'SELECT MAX(simulation_number) AS lastNumber FROM simulations WHERE user_id = ?'
        );
        getLastSimNumberStmt.get(user_id, (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Помилка при зчитуванні минулих симуляцій.');
            }

            const lastNumber = row.lastNumber || 0;
            const newNumber = lastNumber + 1;

            // Тепер вставляємо симуляцію
            const insertSimStmt = db.prepare(`
                INSERT INTO simulations (user_id, simulation_number, volume, speed, density, turbulence, length, thickness)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertSimStmt.run(
                user_id, newNumber, volume, speed, density, turbulence, length, thickness,
                (insertErr) => {
                    if (insertErr) {
                        console.error(insertErr);
                        return res.status(500).send('Помилка при збереженні симуляції.');
                    }
                    res.status(200).send('Симуляцію збережено.');
                }
            );

            insertSimStmt.finalize();
        });

        getLastSimNumberStmt.finalize();
    });

    getUserStmt.finalize();
});

app.get('/api/user-info', (req, res) => {
    if (!req.session.user) return res.status(401).send('Не авторизовано');
    res.json({ username: req.session.user.username });
});

app.get('/api/user-simulations', (req, res) => {
    if (!req.session.user) return res.status(401).send('Не авторизовано');

    const getUserStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    getUserStmt.get(req.session.user.username, (err, row) => {
        if (err || !row) return res.status(500).send('Помилка користувача');

        const userId = row.id;
        const simStmt = db.prepare('SELECT * FROM simulations WHERE user_id = ? ORDER BY simulation_number ASC');
        simStmt.all(userId, (err, simulations) => {
            if (err) return res.status(500).send('Помилка завантаження симуляцій');
            res.json(simulations);
        });
        simStmt.finalize();
    });
    getUserStmt.finalize();
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
});

app.post('/api/set-current-simulation', (req, res) => {
    req.session.currentSim = req.body;
    res.sendStatus(200);
});

app.get('/api/get-current-simulation', (req, res) => {
    if (!req.session.currentSim) return res.status(404).send('Симуляцію не вибрано');
    res.json(req.session.currentSim);
});

app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});

