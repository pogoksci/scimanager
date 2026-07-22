// /js/core/fab.js
(function () {
    let menuContainer = null;

    function createMenuContainer() {
        if (menuContainer) return;
        menuContainer = document.createElement("div");
        menuContainer.id = "fab-menu-container";
        Object.assign(menuContainer.style, {
            // All styles moved to #fab-menu-container in styles.css
        });
        document.body.appendChild(menuContainer);

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (menuContainer && menuContainer.style.display === 'flex') {
                if (!e.target.closest('#fab-button') && !e.target.closest('#fab-menu-container')) {
                    toggleMenu(false);
                }
            }
        });
    }

    function toggleMenu(force) {
        if (!menuContainer) createMenuContainer();
        const current = menuContainer.style.display === "flex";
        const next = force !== undefined ? force : !current;

        const fab = document.getElementById("fab-button");
        if (next && fab) {
            const rect = fab.getBoundingClientRect();
            const bottomOffset = window.innerHeight - rect.top + 10;
            const centerX = rect.left + (rect.width / 2);

            menuContainer.style.bottom = `${bottomOffset}px`;
            menuContainer.style.left = `${centerX}px`;
            menuContainer.style.right = 'auto';
            menuContainer.style.transform = 'translateX(-50%)';
            menuContainer.style.alignItems = 'center';
        }

        menuContainer.style.display = next ? "flex" : "none";

        // Sync FAB Icon
        if (fab) {
            const icon = fab.querySelector('.material-symbols-outlined');
            if (icon && fab.dataset.mode === 'menu') {
                icon.textContent = next ? "close" : "menu";
            }
        }
    }

    /**
     * FAB 버튼 표시/숨김을 제어하는 함수
     * @param {boolean} visible - true이면 표시, false이면 숨김
     */
    function setVisibility(visible, text = null, onClickAction = null) {
        // ✅ 권한 체크: Student/Guest는 FAB 사용 불가 (Add/Create 버튼 등)
        const role = App.Auth?.user?.role || 'guest';
        if (!['admin', 'teacher'].includes(role)) {
            visible = false;
        }

        const fab = document.getElementById("fab-button");
        if (!fab) return;

        fab.style.display = visible ? "flex" : "none"; // Using flex for centering
        // Ensure flex layout defaults if not in css
        fab.style.alignItems = "center";
        fab.style.justifyContent = "center";
        fab.style.gap = "8px";

        if (visible) {
            // mode reset
            fab.dataset.mode = 'action';

            if (text) {
                fab.innerHTML = text;
            }
            if (onClickAction) {
                fab.onclick = onClickAction;
            }

            // If menu was open, close it
            toggleMenu(false);
        } else {
            fab.onclick = null;
            toggleMenu(false);
        }
    }

    function setMenu(items) {
        // ✅ 권한 체크: Student/Guest는 Detail 페이지의 Menu FAB 사용 불가
        const role = App.Auth?.user?.role || 'guest';
        if (!['admin', 'teacher'].includes(role)) {
            hide();
            return;
        }

        const fab = document.getElementById("fab-button");
        if (!fab) return;

        createMenuContainer();
        menuContainer.innerHTML = ""; // Clear existing

        items.forEach(item => {
            const btn = document.createElement("button");
            // Basic Styling
            btn.className = "fab-menu-item";
            // Styles moved to .fab-menu-item in styles.css

            btn.innerHTML = `<span class="material-symbols-outlined" style="color:#555;">${item.icon}</span> <span>${item.label}</span>`;
            btn.onclick = (e) => {
                e.stopPropagation();
                toggleMenu(false);
                if (item.onClick) item.onClick();
            };
            menuContainer.appendChild(btn);
        });

        // Configure FAB as Menu Trigger
        fab.dataset.mode = 'menu';
        fab.style.display = 'flex';
        fab.innerHTML = '<span class="material-symbols-outlined">menu</span> <span style="font-weight:bold;">메뉴</span>';
        fab.onclick = (e) => {
            e.stopPropagation();
            toggleMenu();
        };
    }

    function hide() {
        const fab = document.getElementById("fab-button");
        if (fab) fab.style.display = "none";
        toggleMenu(false); // Ensure menu is closed when hiding FAB
    }

    function show() {
        const fab = document.getElementById("fab-button");
        if (fab) fab.style.display = "flex";
    }

    function setDisabled(disabled) {
        const fabs = document.querySelectorAll(".fab");

        fabs.forEach(fab => {
            if (disabled) {
                fab.style.opacity = "0.5";
                fab.style.pointerEvents = "none";
                fab.style.filter = "grayscale(100%)";
            } else {
                fab.style.opacity = "";
                fab.style.pointerEvents = "";
                fab.style.filter = "";
            }
        });
    }

    // App 전역 객체가 없으면 생성
    globalThis.App = globalThis.App || {};

    // App.Fab 객체를 생성하고 등록
    globalThis.App.Fab = {
        setVisibility: setVisibility,
        setMenu: setMenu,
        hide: hide,
        show: show,
        setDisabled: setDisabled
    };
})();