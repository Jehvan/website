const carousel = document.querySelector(".carousel"),
    firstImg = carousel.querySelectorAll("img")[0],
    arrowIcons = document.querySelectorAll(".wrapper i");

let isDragStart = false, isDragging = false, prevPageX, prevScrollLeft, positionDiff;

// Show/hide the scroll arrows based on the scroll position
const showHideIcons = () => {
    let scrollWidth = carousel.scrollWidth - carousel.clientWidth; // Maximum scrollable width

    // Show/hide the left arrow if not at the start
    arrowIcons[0].style.display = carousel.scrollLeft > 0 ? "block" : "block";

    // Show/hide the right arrow if not at the end
    arrowIcons[1].style.display = carousel.scrollLeft < scrollWidth ? "block" : "block";
};

// Scroll the carousel when the arrow is clicked
arrowIcons.forEach(icon => {
    icon.addEventListener("click", () => {
        let firstImgWidth = firstImg.clientWidth; // Get the width of the first image
        carousel.scrollLeft += icon.id === "left" ? -firstImgWidth : firstImgWidth;
        setTimeout(() => showHideIcons(), 60); // Delay to update icon visibility after scrolling
    });
});

// Drag functionality
const dragStart = (e) => {
    isDragStart = true;
    prevPageX = e.pageX || e.touches[0].pageX;
    prevScrollLeft = carousel.scrollLeft;
};

const dragging = (e) => {
    if (!isDragStart) return;
    e.preventDefault();
    isDragging = true;
    positionDiff = (e.pageX || e.touches[0].pageX) - prevPageX;
    carousel.scrollLeft = prevScrollLeft - positionDiff;
    showHideIcons(); // Call to show/hide icons during dragging
};

const dragStop = () => {
    isDragStart = false;
    carousel.classList.remove("dragging");

    if (!isDragging) return;
    isDragging = false;
    autoSlide();
};

// Auto-slide to the nearest image after drag
const autoSlide = () => {
    let firstImgWidth = firstImg.clientWidth;
    let absPositionDiff = Math.abs(positionDiff);

    if (absPositionDiff > firstImgWidth / 3) {
        carousel.scrollLeft += positionDiff > 0 ? firstImgWidth - absPositionDiff : -(firstImgWidth - absPositionDiff);
    } else {
        carousel.scrollLeft -= absPositionDiff;
    }
};

// Event listeners for dragging
carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("touchstart", dragStart);
document.addEventListener("mousemove", dragging);
carousel.addEventListener("touchmove", dragging);
document.addEventListener("mouseup", dragStop);
carousel.addEventListener("touchend", dragStop);

// Initial call to show/hide icons
showHideIcons();
