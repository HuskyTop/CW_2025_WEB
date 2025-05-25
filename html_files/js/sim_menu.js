const sliders = [
    { id: 'flowSlider', valueId: 'flowValue' },
    { id: 'speedSlider', valueId: 'speedValue' },
    { id: 'densitySlider', valueId: 'densityValue' },
    { id: 'turbulenceSlider', valueId: 'turbulenceValue' },
    { id: 'chordSlider', valueId: 'chordValue' },
    { id: 'thicknessSlider', valueId: 'thicknessValue' },
];

sliders.forEach(slider => {
    const input = document.getElementById(slider.id);
    const valueDisplay = document.getElementById(slider.valueId);

    // Встановити початкове значення
    valueDisplay.textContent = input.value;

    // Оновлювати значення при зміні повзунка
    input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
    });
});