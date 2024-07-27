document.addEventListener('DOMContentLoaded', () => {
    const quantityContainers = document.querySelectorAll('.quantity-container');

    quantityContainers.forEach(container => {
        const decreaseButton = container.querySelector('.decrease');
        const increaseButton = container.querySelector('.increase');
        const quantityInput = container.querySelector('.quantity-input');

        decreaseButton.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });

        increaseButton.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value);
            quantityInput.value = currentValue + 1;
        });
    });
});
