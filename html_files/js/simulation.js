let isStopped = false;

document.getElementById('simulateBtn').addEventListener('click', function () {
    const advect_val = parseFloat(document.getElementById("flowSlider").value);
    const speed_val = parseInt(document.getElementById("speedSlider").value);
    const density_val = parseFloat(document.getElementById("densitySlider").value);
    const turbulence_val = parseFloat(document.getElementById("turbulenceSlider").value);
    const chord_val = parseInt(document.getElementById("chordSlider").value);
    const thickness_val = parseInt(document.getElementById("thicknessSlider").value) / 100; // у відсотках

    const isPressureEnabled = document.getElementById("pressureToggle").checked;

    // Симуляція 1 — тиск або щільність, залежно від isPressureEnabled
    simulation(
        'simulation-area',              // ID канваса
        advect_val,                       // Потік
        density_val,                      // Щільність
        turbulence_val,                   // Турбулентність
        isPressureEnabled,                             // Тиск активний
        speed_val,                        // Швидкість
        chord_val,                        // Довжина хорди
        4000,                             // Кроків побудови профілю
        thickness_val                     // Максимальна товщина (в десятковому)
    );

});

document.getElementById('clearBtn').addEventListener('click', function () {
    isStopped = true;
    // simulation('simulation-area', 0, 0, 0, 0, 0,
    //     parseInt(document.getElementById("chordSlider").value),
    //     4000,
    //     parseInt(document.getElementById("thicknessSlider").value) / 100
    // );
});

document.getElementById('saveBtn').addEventListener('click', () => { // При збереженні симуляції
    const data = {
        volume: parseFloat(document.getElementById('flowSlider').value),
        speed: parseInt(document.getElementById('speedSlider').value),
        density: parseFloat(document.getElementById('densitySlider').value),
        turbulence: parseFloat(document.getElementById('turbulenceSlider').value),
        length: parseInt(document.getElementById('chordSlider').value),
        thickness: parseInt(document.getElementById('thicknessSlider').value)
    };

    fetch('/save-simulation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(res => res.text())
        .then(msg => alert(msg))
        .catch(err => console.error('Помилка:', err));
});

fetch('/api/get-current-simulation') // Для завантаження симуляції
    .then(res => {
        if (!res.ok) return;
        return res.json();
    })
    .then(sim => {
        if (!sim) return;

        // Заповнюємо слайдери значеннями
        document.getElementById('flowSlider').value = sim.volume;
        document.getElementById('flowValue').textContent = sim.volume;

        document.getElementById('speedSlider').value = sim.speed;
        document.getElementById('speedValue').textContent = sim.speed;

        document.getElementById('densitySlider').value = sim.density;
        document.getElementById('densityValue').textContent = sim.density;

        document.getElementById('turbulenceSlider').value = sim.turbulence;
        document.getElementById('turbulenceValue').textContent = sim.turbulence;

        document.getElementById('chordSlider').value = sim.length;
        document.getElementById('chordValue').textContent = sim.length;

        document.getElementById('thicknessSlider').value = sim.thickness;
        document.getElementById('thicknessValue').textContent = sim.thickness;
    });

function simulation(
    simulation_id, advect_val = 0, diffuseDensity_val = 0.1, turbulence_val = 0.005,
    is_pressure = true, density_val = 3.0,
    wing_chord = 200, wing_steps = 500, wing_a = 0.12
) {
    const canvas = document.getElementById(simulation_id);
    const ctx = canvas.getContext('2d');

    canvas.width = 600;
    canvas.height = 400;

    ctx.strokeStyle = '#ccc';
    ctx.font = '10px Arial';
    ctx.fillStyle = '#555';

    function drawGrid(markGridSize) {  // markGridSize - крок для маркування сітки
        // Вертикальні лінії
        for (let x = 0; x <= canvas.width; x += markGridSize) {
            ctx.strokeStyle = '#545454';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            if (x % 100 == 0) {
                ctx.fillStyle = '#e3e3e3';
                ctx.fillText(x, x + 2, 10);
            }
        }

        // Горизонтальні лінії
        for (let y = 0; y <= canvas.height; y += markGridSize) {
            ctx.strokeStyle = '#545454';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            if (y % 100 == 0) {
                ctx.fillStyle = '#e3e3e3';
                ctx.fillText(y, 2, y - 2);
            }
        }
    }




    //------- Робимо симуляцію -------

    const density = []; // Щільність для кожної клітини
    const obstacles = []; // фізична перешкода
    const pressure = [];

    const vx = []; // швидкість по x для кожної клітинки
    const vy = []; // швидкість по y для кожної клітинки

    const gridSize = 300; // Яка буде к-сть горизонтальних клітин
    const cellSize = canvas.width / gridSize; // 2px - розмір клітини (використовується в функції draw)

    const gridWidth = Math.floor(canvas.width / cellSize);
    const gridHeight = Math.floor(canvas.height / cellSize);


    for (let x = 0; x < gridWidth; x++) {
        vx[x] = [];
        vy[x] = []; // оголошуємо, що це двовимірний масив

        density[x] = []; // щільність
        obstacles[x] = []; // перешкоди
        pressure[x] = []; // тиск

        for (let y = 0; y < gridHeight; y++) {
            vx[x][y] = 1.0; // (px per delta_t) швидкість по x для всієї матриці
            vy[x][y] = 0.0; // (px per delta_t) швидкість по y
            density[x][y] = 0.0; // заповнюємо все нульовою щільністю
            obstacles[x][y] = false;
            pressure[x][y] = 0.0;
        }
    }

    function addLeftDencitySource(density_val = 3.0) { // Додаємо дим в ситему
        for (let y = 0; y <= 200; y++) { // не по всій висоті, а частково
            density[0][y] += density_val; // створюємо джерело диму
        }
    }

    function applyTurbulence(turbulence_val) {
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                if (obstacles[x][y]) continue;

                vx[x][y] += (Math.random() - 0.5) * turbulence_val;
                vy[x][y] -= (Math.random() - 0.5) * turbulence_val * 10;

                // Обмеження — симетричне
                vx[x][y] = Math.max(-2, Math.min(2, vx[x][y]));
                // vy[x][y] = Math.max(-2, Math.min(2, vy[x][y]));
            }
        }
    }

    function drawAirfoilProfile(chord, steps, a) {
        //a - максимальна товщина (12% від хорди)
        //chord - довжина хорди (всього профіля) крила (в пікселях)
        //steps - к-сть ітерацій для побудови (чим більше, тим плавніше)
        const centerX = 100; // центр по X
        const centerY = canvas.height / 2; // центр профіля по Y

        ctx.beginPath();
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 1;

        const points = [];

        // Верхня поверхня
        for (let i = 0; i <= steps; i++) {
            const x = i / steps;
            const y_t = 5 * a * chord * ( // Розрахунок форми по формулі НАСА для симетричних профілів
                0.2969 * Math.sqrt(x)
                - 0.1260 * x
                - 0.3516 * x * x
                + 0.2843 * x * x * x
                - 0.1015 * x * x * x * x
            );

            const px = centerX + x * chord;
            const py = centerY - y_t;
            points.push([px, py]);

            for (let i = centerY - y_t; i <= centerY; i++) { // filling the gap inside wing profile
                points.push([px, i]);
            }

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        // Нижня поверхня
        for (let i = steps; i >= 0; i--) {
            const x = i / steps;
            const y_t = 5 * a * chord * ( // Розрахунок форми по формулі НАСА для симетричних профілів
                0.2969 * Math.sqrt(x)
                - 0.1260 * x
                - 0.3516 * x * x
                + 0.2843 * x * x * x
                - 0.1015 * x * x * x * x
            );

            const px = centerX + x * chord;
            const py = centerY + y_t;
            points.push([px, py]);

            for (let i = centerY + y_t; i >= centerY; i--) { // filling the gap inside wing profile
                points.push([px, i]);
            }

            ctx.lineTo(px, py);
        }

        for (const [px, py] of points) {
            const gridX = Math.floor(px / cellSize); // Округлюємо в більшу сторону
            const gridY = Math.floor(py / cellSize);

            if (
                gridX >= 0 && gridX < canvas.width / cellSize &&
                gridY >= 0 && gridY < canvas.height / cellSize
            ) {
                obstacles[gridX][gridY] = true;
            }
        }

        ctx.closePath();
        ctx.stroke();
    }

    function applyObstacleReflection() {
        for (let x = 1; x < gridWidth - 1; x++) {
            for (let y = 1; y < gridHeight - 1; y++) {
                if (!obstacles[x][y]) continue;

                // Перевіряємо сусідів і змінюємо їхні швидкості
                const dirs = [
                    [-1, 0], [1, 0], [0, -1], [0, 1], // 4 сторони
                    [-1, -1], [1, -1], [-1, 1], [1, 1], // діагоналі
                ];

                for (let [dx, dy] of dirs) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (!obstacles[nx][ny]) {
                        // Вектор від obstacle до вільної клітинки
                        const dot = vx[nx][ny] * dx + vy[nx][ny] * dy;
                        if (dot > 0) {
                            // Віддзеркалення: віднімаємо проєкцію на нормаль
                            const mag2 = dx * dx + dy * dy;
                            const proj = 2 * dot / mag2;

                            vx[nx][ny] -= proj * dx;
                            vy[nx][ny] -= proj * dy;

                            // (опціонально) приглушення енергії після зіткнення:
                            vx[nx][ny] *= 0.7;
                            vy[nx][ny] *= 0.7;
                        }
                    }
                }
            }
        }
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    function computePressure() {
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                if (obstacles[x][y]) {
                    pressure[x][y] = 0;
                    continue;
                }

                let sum = 0;
                let count = 0;

                for (let [dx, dy] of dirs) {
                    const nx = x + dx; // перебираємо всі навколишні точки
                    const ny = y + dy;
                    if (
                        nx >= 0 && nx < canvas.width / cellSize &&
                        ny >= 0 && ny < canvas.height / cellSize &&
                        !obstacles[nx][ny]
                    ) {
                        sum += density[nx][ny];
                        count++;
                    }
                }

                const avg = count > 0 ? sum / count : 0;
                pressure[x][y] = avg - density[x][y];
            }
        }
    }


    function advect(dt) { // Переміщення 
        const newDensity = [];

        for (let x = 0; x < gridWidth; x++) {
            newDensity[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                if (obstacles[x][y]) { // Перевірка на перешкоду
                    newDensity[x][y] = 0; // у перешкоді немає диму
                    continue;
                }

                const xPrev = x - vx[x][y] * dt; // типу просто лінійне рівняння для обчислення попереднтої точки
                const yPrev = y - vy[x][y] * dt;

                const x0 = Math.floor(xPrev); // Округлюємо в більшу сторону
                const y0 = Math.floor(yPrev);

                if (x0 >= 0 && x0 < gridWidth && y0 >= 0 && y0 < gridHeight) { //перевірка на те, чи не виходить попередні координати за рамки
                    newDensity[x][y] = density[x0][y0] * 0.99999999; // трохи згасає
                } else {
                    newDensity[x][y] = 0;
                }
            }
        }

        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                density[x][y] = newDensity[x][y];
            }
        }
    }

    function diffuseDensity(diffuseDensity_val) { // коефіцієнт розтікання (0.1 - 1)
        const newDensity = [];

        for (let x = 0; x < gridWidth; x++) {
            newDensity[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                if (obstacles[x][y]) {
                    newDensity[x][y] = 0;
                    continue;
                }

                let sum = density[x][y];
                let count = 1;

                // сусідні клітини (від 4-х сторін)
                const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (let [dx, dy] of dirs) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (
                        nx >= 0 && nx < gridWidth &&
                        ny >= 0 && ny < gridHeight &&
                        !obstacles[nx][ny]
                    ) {
                        sum += density[nx][ny];
                        count++;
                    }
                }

                newDensity[x][y] = (1 - diffuseDensity_val) * density[x][y] + diffuseDensity_val * (sum / count);
            }
        }

        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                density[x][y] = newDensity[x][y];
            }
        }
    }

    function draw(is_pressure) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); //clearing all area from any objects
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                if (obstacles[x][y]) { // раптом перешкода за цими координатами - зафарбуємо
                    ctx.fillStyle = 'black'; // перешкоди — чорні
                } else {
                    if (is_pressure) {
                        const p = pressure[x][y];
                        const preassure_intensity = Math.min(Math.abs(p) * 800, 255);
                        const color = p > 0
                            ? `rgb(${preassure_intensity}, 0, 0)`
                            : `rgb(0, 0, ${preassure_intensity})`;
                        ctx.fillStyle = color;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    } else {
                        const d = density[x][y];
                        const density_intensity = Math.min(d * 25, 255);
                        ctx.fillStyle = `rgb(${density_intensity}, ${density_intensity}, ${density_intensity})`;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }


                }
            }
        }
        drawGrid(50);
    }

    // 🔁 Основний цикл
    function step() {
        if (isStopped) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawAirfoilProfile(wing_chord, wing_steps, wing_a);
            isStopped = false;
            return;
        }

        addLeftDencitySource(density_val);
        advect(advect_val); // параметр прискоренння переміщення щільності

        diffuseDensity(diffuseDensity_val); // Щільність потоку
        computePressure();
        applyTurbulence(turbulence_val);
        applyObstacleReflection(); // 

        draw(is_pressure);


        requestAnimationFrame(step);
    }


    drawAirfoilProfile(wing_chord, wing_steps, wing_a);
    step();

}