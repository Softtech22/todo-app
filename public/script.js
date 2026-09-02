// ===== DOM Elements =====
const categoryInput = document.getElementById('categoryInput');
const todoInput = document.getElementById('todoInput');
const dueDateInput = document.getElementById('dueDateInput');
const timeInput = document.getElementById('timeInput');
const todoList = document.getElementById('todoList');
const taskCount = document.getElementById('taskCount');
const themeBtn = document.getElementById('themeBtn');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const reminderToggle = document.getElementById('reminderToggle');
const reminderDateTime = document.getElementById('reminderDateTime');
const activeTab = document.getElementById('activeTab');
const historyTab = document.getElementById('historyTab');
const activeBadge = document.getElementById('activeBadge');
const historyBadge = document.getElementById('historyBadge');
const MAX_TASKS = 10;

// ===== Wizard Steps =====
const steps = [
    { id: 'step1', input: categoryInput, label: 'Category', required: true },
    { id: 'step2', input: todoInput, label: 'Task', required: true },
    { id: 'step3', input: dueDateInput, label: 'Due Date', required: false },
    { id: 'step4', input: timeInput, label: 'Time', required: false }
];

let currentStep = 0;
let allTodos = [];
let currentTab = 'active'; // 'active' or 'history'

// ===== Set min date for due date =====
const today = new Date().toISOString().split('T')[0];
dueDateInput.setAttribute('min', today);

// ===== Wizard Navigation =====
function goToStep(stepIndex) {
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');

    const step = document.getElementById(steps[stepIndex].id);
    step.style.display = 'flex';
    step.classList.remove('fade-out');
    void step.offsetWidth;
    step.style.animation = 'none';
    void step.offsetWidth;
    step.style.animation = 'fadeSlide 0.5s ease';

    document.querySelectorAll('.step-dot').forEach((dot, index) => {
        dot.classList.remove('active', 'done');
        if (index < stepIndex) dot.classList.add('done');
        else if (index === stepIndex) dot.classList.add('active');
    });

    document.querySelectorAll('.step-line').forEach((line, index) => {
        line.classList.toggle('done', index < stepIndex);
    });

    steps[stepIndex].input.focus();
    currentStep = stepIndex;
}

function nextStep() {
    const currentInput = steps[currentStep].input;
    const value = currentInput.value.trim();

    if (steps[currentStep].required && !value) {
        showToast(`Please enter ${steps[currentStep].label}!`, 'warning');
        currentInput.style.borderColor = '#dc3545';
        setTimeout(() => currentInput.style.borderColor = '', 1000);
        return;
    }

    const stepElement = document.getElementById(steps[currentStep].id);
    stepElement.classList.add('fade-out');

    setTimeout(() => {
        if (currentStep < steps.length - 1) {
            goToStep(currentStep + 1);
        } else {
            addTask();
        }
    }, 400);
}

// ===== Handle Enter key =====
categoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') nextStep();
});
todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') nextStep();
});
dueDateInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') nextStep();
});
timeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') nextStep();
});

// ===== Add Task =====
async function addTask() {
    const category = categoryInput.value.trim();
    const task = todoInput.value.trim();
    const dueDate = dueDateInput.value;
    const time = timeInput.value;
    const reminder = reminderToggle.checked ? reminderDateTime.value : '';

    if (!category) {
        showToast('Category is required!', 'warning');
        goToStep(0);
        return;
    }
    if (!task) {
        showToast('Task is required!', 'warning');
        goToStep(1);
        return;
    }

    if (allTodos.length >= MAX_TASKS) {
        showToast(`Maximum ${MAX_TASKS} tasks allowed!`, 'error');
        return;
    }

    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, category, dueDate, time, reminder, completed: false })
        });

        if (response.ok) {
            categoryInput.value = '';
            todoInput.value = '';
            dueDateInput.value = '';
            timeInput.value = '';
            reminderToggle.checked = false;
            reminderDateTime.value = '';
            reminderDateTime.style.display = 'none';
            goToStep(0);

            loadTodos();
            showToast('Task added! 🎉', 'success');

            if (reminder) {
                setReminder(task, category, reminder);
            }
        }
    } catch (error) {
        console.error('Error adding todo:', error);
        showToast('Error adding task!', 'error');
    }
}

// ===== Reminder System =====
function setReminder(task, category, reminderTime) {
    const reminderDate = new Date(reminderTime);
    const now = new Date();
    const timeDiff = reminderDate.getTime() - now.getTime();

    if (timeDiff > 0) {
        setTimeout(() => {
            showToast(`🔔 REMINDER: "${task}" (${category}) is due now!`, 'info');
            if (Notification.permission === 'granted') {
                new Notification('⏰ Task Reminder', {
                    body: `"${task}" in ${category} is due!`,
                    icon: '📋'
                });
            }
        }, timeDiff);
        showToast(`Reminder set for ${reminderDate.toLocaleString()}`, 'info');
    } else {
        showToast('Reminder time must be in the future!', 'warning');
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

reminderToggle.addEventListener('change', () => {
    reminderDateTime.style.display = reminderToggle.checked ? 'block' : 'none';
    if (reminderToggle.checked) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        reminderDateTime.value = now.toISOString().slice(0, 16);
    }
});

// ===== Navigation Tabs =====
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (tab === 'active') {
        activeTab.classList.add('active');
    } else {
        historyTab.classList.add('active');
    }
    applyFilterAndSearch();
}

activeTab.addEventListener('click', () => switchTab('active'));
historyTab.addEventListener('click', () => switchTab('history'));

// ===== Load Todos =====
async function loadTodos() {
    try {
        const response = await fetch('/api/todos');
        allTodos = await response.json();
        updateBadges();
        applyFilterAndSearch();
    } catch (error) {
        console.error('Error loading todos:', error);
        showToast('Error loading tasks!', 'error');
    }
}

// ===== Update Badges =====
function updateBadges() {
    const active = allTodos.filter(t => !t.completed);
    const history = allTodos.filter(t => t.completed);
    activeBadge.textContent = active.length;
    historyBadge.textContent = history.length;
}

// ===== Apply Filter and Search =====
function applyFilterAndSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const filter = filterSelect.value;

    let filtered = allTodos;

    // Filter by tab
    if (currentTab === 'active') {
        filtered = filtered.filter(t => !t.completed);
    } else {
        filtered = filtered.filter(t => t.completed);
    }

    // Filter by status (only for active tab)
    if (currentTab === 'active') {
        if (filter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (filter === 'active') {
            filtered = filtered.filter(t => !t.completed);
        }
    }

    // Search
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.task.toLowerCase().includes(searchTerm) ||
            (t.category && t.category.toLowerCase().includes(searchTerm))
        );
    }

    renderTodos(filtered);
    updateTaskCount(allTodos);
}

// ===== Update Task Count =====
function updateTaskCount(todos) {
    const incomplete = todos.filter(t => !t.completed);
    taskCount.textContent = incomplete.length;
}

// ===== Toast Notification =====
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ===== Render Todos =====
function renderTodos(todos) {
    todoList.innerHTML = '';

    if (todos.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '40px 20px';
        emptyMsg.style.color = '#999';
        emptyMsg.style.cursor = 'default';
        emptyMsg.style.background = 'transparent';
        emptyMsg.innerHTML = `
            <div style="font-size:48px;margin-bottom:10px;">${currentTab === 'active' ? '📝' : '📜'}</div>
            <div style="font-size:16px;">${currentTab === 'active' ? 'No active tasks. Add one above!' : 'No completed tasks yet. Get to work!'}</div>
        `;
        todoList.appendChild(emptyMsg);
        return;
    }

    todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.setAttribute('data-id', todo.id);
        li.setAttribute('data-index', index);

        // Only make active tasks draggable
        if (!todo.completed) {
            li.draggable = true;
        }

        // If completed, add completed class
        if (todo.completed) {
            li.classList.add('completed-task');
        }

        // Drag handle (only for active tasks)
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = todo.completed ? '✓' : '⠿';
        dragHandle.style.color = todo.completed ? '#28a745' : '#bbb';

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        // Task text
        const taskSpan = document.createElement('span');
        taskSpan.className = 'task-text';
        if (todo.completed) taskSpan.classList.add('completed');
        taskSpan.textContent = todo.task;

        // Toggle completion on click (only for active tasks)
        if (!todo.completed) {
            taskSpan.addEventListener('click', async () => {
                try {
                    const response = await fetch(`/api/todos/${todo.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ toggleComplete: true })
                    });
                    if (response.ok) {
                        // Animate fade out
                        li.classList.add('fade-out');
                        setTimeout(() => {
                            loadTodos();
                            showToast('Task completed! ✅', 'success');
                        }, 500);
                    }
                } catch (error) {
                    console.error('Error completing task:', error);
                    showToast('Error updating task!', 'error');
                }
            });
        }

        // Edit input
        const editInput = document.createElement('input');
        editInput.className = 'edit-input';
        editInput.type = 'text';
        editInput.value = todo.task;

        // Meta
        const metaDiv = document.createElement('div');
        metaDiv.className = 'task-meta';

        if (todo.category) {
            const catBadge = document.createElement('span');
            catBadge.className = 'category-badge';
            catBadge.textContent = `📁 ${todo.category}`;
            metaDiv.appendChild(catBadge);
        }

        if (todo.dueDate) {
            const dueSpan = document.createElement('span');
            dueSpan.className = 'due-date';
            const today = new Date().toISOString().split('T')[0];
            if (todo.dueDate < today && !todo.completed) {
                dueSpan.classList.add('overdue');
                dueSpan.textContent = `⏰ ${todo.dueDate} (Overdue!)`;
            } else {
                dueSpan.textContent = `📅 ${todo.dueDate}`;
            }
            metaDiv.appendChild(dueSpan);
        }

        if (todo.time) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'due-date';
            timeSpan.textContent = `🕐 ${todo.time}`;
            metaDiv.appendChild(timeSpan);
        }

        if (todo.reminder) {
            const remSpan = document.createElement('span');
            remSpan.className = 'reminder-badge';
            remSpan.textContent = '🔔 Reminder';
            metaDiv.appendChild(remSpan);
        }

        if (todo.completed) {
            const doneSpan = document.createElement('span');
            doneSpan.className = 'completed-badge';
            doneSpan.textContent = '✅ Done';
            metaDiv.appendChild(doneSpan);
        }

        contentDiv.appendChild(taskSpan);
        contentDiv.appendChild(editInput);
        contentDiv.appendChild(metaDiv);

        // Buttons (only for active tasks)
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';

        if (!todo.completed) {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '✏️';
            editBtn.title = 'Edit task';
            editBtn.addEventListener('click', () => {
                taskSpan.style.display = 'none';
                editInput.classList.add('active');
                editInput.focus();
                editBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-btn';
            saveBtn.textContent = '💾';
            saveBtn.title = 'Save changes';
            saveBtn.style.display = 'none';
            saveBtn.addEventListener('click', async () => {
                const newTask = editInput.value.trim();
                if (!newTask) {
                    showToast('Task cannot be empty!', 'warning');
                    return;
                }
                try {
                    const response = await fetch(`/api/todos/${todo.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ task: newTask })
                    });
                    if (response.ok) {
                        loadTodos();
                        showToast('Task updated!', 'success');
                    }
                } catch (error) {
                    console.error('Error updating todo:', error);
                    showToast('Error updating task!', 'error');
                }
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-btn';
            cancelBtn.textContent = '❌';
            cancelBtn.title = 'Cancel edit';
            cancelBtn.style.display = 'none';
            cancelBtn.addEventListener('click', () => {
                editInput.classList.remove('active');
                taskSpan.style.display = 'block';
                editBtn.style.display = 'inline-block';
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                editInput.value = todo.task;
            });

            editInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Delete task';
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete "${todo.task}"?`)) {
                    deleteTask(todo.id);
                }
            });

            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(saveBtn);
            btnGroup.appendChild(cancelBtn);
            btnGroup.appendChild(deleteBtn);
        } else {
            // For completed tasks, show a "Restore" button
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'edit-btn';
            restoreBtn.textContent = '↩️';
            restoreBtn.title = 'Restore task';
            restoreBtn.style.background = '#28a745';
            restoreBtn.style.color = 'white';
            restoreBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`/api/todos/${todo.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ restore: true })
                    });
                    if (response.ok) {
                        loadTodos();
                        showToast('Task restored! 🔄', 'success');
                    }
                } catch (error) {
                    console.error('Error restoring task:', error);
                    showToast('Error restoring task!', 'error');
                }
            });
            btnGroup.appendChild(restoreBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Delete permanently';
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Permanently delete "${todo.task}" from history?`)) {
                    deleteTask(todo.id);
                }
            });
            btnGroup.appendChild(deleteBtn);
        }

        li.appendChild(dragHandle);
        li.appendChild(contentDiv);
        li.appendChild(btnGroup);
        todoList.appendChild(li);
    });

    if (currentTab === 'active') {
        setupDragAndDrop();
    }
}

// ===== Drag and Drop =====
function setupDragAndDrop() {
    const items = document.querySelectorAll('#todoList li:not(.completed-task)');
    let draggedItem = null;

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.getAttribute('data-id'));
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.currentTarget;
            if (target !== draggedItem && !target.classList.contains('completed-task')) {
                const rect = target.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    target.parentNode.insertBefore(draggedItem, target);
                } else {
                    target.parentNode.insertBefore(draggedItem, target.nextSibling);
                }
            }
        });
    });
}

// ===== Delete Task =====
async function deleteTask(id) {
    try {
        const response = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadTodos();
            showToast('Task deleted!', 'success');
        }
    } catch (error) {
        console.error('Error deleting todo:', error);
        showToast('Error deleting task!', 'error');
    }
}

// ===== Search & Filter =====
searchInput.addEventListener('input', applyFilterAndSearch);
filterSelect.addEventListener('change', applyFilterAndSearch);

// ===== Theme Toggle =====
let darkMode = false;
themeBtn.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    themeBtn.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    showToast(darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
});

// ===== Backup =====
backupBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/todos');
        const todos = await response.json();
        const backup = { date: new Date().toISOString(), tasks: todos };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todo-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup downloaded! 💾', 'success');
    } catch (error) {
        console.error('Error backing up:', error);
        showToast('Error creating backup!', 'error');
    }
});

// ===== Restore =====
restoreBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            if (!backup.tasks || !Array.isArray(backup.tasks)) {
                showToast('Invalid backup file!', 'error');
                return;
            }
            for (const todo of allTodos) {
                await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
            }
            for (const todo of backup.tasks) {
                await fetch('/api/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task: todo.task,
                        category: todo.category || '',
                        dueDate: todo.dueDate || '',
                        time: todo.time || '',
                        reminder: todo.reminder || '',
                        completed: todo.completed || false
                    })
                });
            }
            loadTodos();
            showToast('Backup restored! ✅', 'success');
        } catch (error) {
            console.error('Error restoring backup:', error);
            showToast('Error restoring backup!', 'error');
        }
    };
    input.click();
});

// ===== Clear All =====
clearBtn.addEventListener('click', () => {
    if (allTodos.length === 0) {
        showToast('No tasks to clear!', 'warning');
        return;
    }
    if (confirm('Are you sure you want to delete ALL tasks from both active and history?')) {
        Promise.all(allTodos.map(todo =>
            fetch(`/api/todos/${todo.id}`, { method: 'DELETE' })
        )).then(() => {
            loadTodos();
            showToast('All tasks cleared!', 'success');
        });
    }
});

// ===== Initialize =====
goToStep(0);
loadTodos();