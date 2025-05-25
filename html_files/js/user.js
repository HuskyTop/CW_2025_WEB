fetch('/api/user-info')
    .then(res => res.json())
    .then(data => {
        document.getElementById('username-display').textContent = `Вітаю, ${data.username}`;
    });

// Завантаження таблиці симуляцій
fetch('/api/user-simulations')
    .then(res => res.json())
    .then(simulations => {
        const tbody = document.querySelector('#simTable tbody');
        tbody.innerHTML = '';

        simulations.forEach((sim, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sim.simulation_number}</td>
                <td>${sim.volume}</td>
                <td>${sim.speed}</td>
                <td>${sim.density}</td>
                <td>${sim.turbulence}</td>
                <td>${sim.length}</td>
                <td>${sim.thickness}</td>
                <td><button class="load-btn" data-sim='${JSON.stringify(sim)}'>Завантажити</button></td>
            `;
            tbody.appendChild(row);
        });
    });

// Вихід із акаунту
document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/logout', { method: 'POST' })
        .then(() => window.location.href = '/user');
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('load-btn')) {
        const sim = JSON.parse(e.target.dataset.sim);

        fetch('/api/set-current-simulation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sim)
        })
            .then(res => {
                if (res.ok) window.location.href = '/simulation';
            });
    }
});
