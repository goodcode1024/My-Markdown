// App State
class NotesApp {
    constructor() {
        this.notes = JSON.parse(localStorage.getItem('notes')) || [];
        this.currentNote = null;
        this.currentWorkspace = localStorage.getItem('currentWorkspace') || 'public';
        this.workspaces = JSON.parse(localStorage.getItem('workspaces')) || ['public', 'private'];
        const defaultSettings = {
            theme: 'light',
            fontSize: 14,
            autoSave: true,
            aiEnabled: false,
            aiApiKey: '',
            aiBaseUrl: 'https://api.deepseek.com',
            aiModel: 'deepseek-chat'
        };
        const savedSettings = JSON.parse(localStorage.getItem('settings')) || {};
        this.settings = Object.assign({}, defaultSettings, savedSettings);
        this.autoSaveTimer = null;
        this.isPreviewMode = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadWorkspace();
        this.createDefaultTutorial();
        this.renderNotesList();
        this.applySettings();
        this.setupMarkdownRenderer();
        this.setupDrawingCanvas();

        
        // Setup image toggle handlers for editor
        document.getElementById('editor').addEventListener('input', () => {
            // Image toggle handlers will be added here if needed
        });
        
        // Load first note if exists
        if (this.notes.length > 0) {
            this.loadNote(this.notes[0].id);
        }
    }
    
    setupEventListeners() {
        // Sidebar events
        document.getElementById('newNote').addEventListener('click', () => this.createNote());
        document.getElementById('importNote').addEventListener('click', () => this.importNote());
        document.getElementById('settings').addEventListener('click', () => this.showSettings());
        document.getElementById('workspaceSelect').addEventListener('change', (e) => this.switchWorkspace(e.target.value));
        document.getElementById('newWorkspace').addEventListener('click', () => this.createWorkspace());
        
        // Toolbar events
        document.getElementById('saveNote').addEventListener('click', () => this.saveCurrentNote());
        document.getElementById('deleteNote').addEventListener('click', () => this.deleteCurrentNote());
        document.getElementById('exportPDF').addEventListener('click', () => this.exportToPDF());
        document.getElementById('exportHTML').addEventListener('click', () => this.exportToHTML());
        document.getElementById('exportImage').addEventListener('click', () => this.exportToImage());
        document.getElementById('togglePreview').addEventListener('click', () => this.togglePreview());
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // Editor events
        document.getElementById('noteTitle').addEventListener('input', () => this.onContentChange());
        document.getElementById('editor').addEventListener('input', (e) => {
            this.onContentChange();
        });
        document.getElementById('editor').addEventListener('keydown', (e) => {
            this.handleAITrigger(e);
        });
        document.getElementById('editor').addEventListener('scroll', () => this.syncScroll());
        document.getElementById('editor').addEventListener('click', (e) => this.handleEditorClick(e));
        
        // Markdown toolbar events
        document.getElementById('markdownToolbar').addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                this.handleMarkdownAction(e.target.closest('button'));
            }
        });
        
        // Modal events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });
        
        // File input events
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageInsert(e));
        document.getElementById('fileAttachment').addEventListener('change', (e) => this.handleFileAttachment(e));
        
        // Settings events
        document.getElementById('themeSelect').addEventListener('change', (e) => this.changeTheme(e.target.value));
        document.getElementById('fontSizeSlider').addEventListener('input', (e) => this.changeFontSize(e.target.value));
        document.getElementById('autoSave').addEventListener('change', (e) => this.toggleAutoSave(e.target.checked));
        document.getElementById('aiEnabled').addEventListener('change', (e) => this.toggleAI(e.target.checked));
        document.getElementById('aiApiKey').addEventListener('input', (e) => this.updateAISetting('aiApiKey', e.target.value));
        document.getElementById('aiBaseUrl').addEventListener('input', (e) => this.updateAISetting('aiBaseUrl', e.target.value));
        document.getElementById('aiModel').addEventListener('input', (e) => this.updateAISetting('aiModel', e.target.value));
        
        // Mobile sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Window events
        window.addEventListener('beforeunload', () => this.saveCurrentNote());
        window.addEventListener('resize', () => this.handleResize());
        
        // Touch events for mobile
        this.setupTouchEvents();
    }
    
    // Note Management
    createNote(template = null) {
        if (template) {
            this.showTemplateModal();
            return;
        }
        
        const note = {
            id: Date.now().toString(),
            title: '无标题',
            content: '',
            workspace: this.currentWorkspace,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotesList();
        this.loadNote(note.id);
        
        // Focus on title
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
    }
    
    loadNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;
        
        this.currentNote = note;
        document.getElementById('noteTitle').value = note.title;
        // 在加载到编辑器时，将完整的base64数据转换为收起格式
        const processedContent = this.processContentForDisplay(note.content);
        document.getElementById('editor').value = processedContent;
        
        this.updateActiveNote(noteId);
        this.updatePreview();

    }
    
    saveCurrentNote() {
        if (!this.currentNote) return;
        
        const title = document.getElementById('noteTitle').value.trim() || '无标题';
        const content = document.getElementById('editor').value;
        
        this.currentNote.title = title;
        this.currentNote.content = this.processContentForSave(content);
        this.currentNote.updatedAt = new Date().toISOString();
        
        this.saveNotes();
        this.renderNotesList();
        this.updateActiveNote(this.currentNote.id);
    }
    
    deleteCurrentNote() {
        if (!this.currentNote) return;
        
        if (confirm('确定要删除这篇笔记吗？')) {
            this.notes = this.notes.filter(n => n.id !== this.currentNote.id);
            this.saveNotes();
            this.renderNotesList();
            
            // Load next note or clear editor
            if (this.notes.length > 0) {
                this.loadNote(this.notes[0].id);
            } else {
                this.currentNote = null;
                document.getElementById('noteTitle').value = '';
                document.getElementById('editor').value = '';
                this.updatePreview();
            }
        }
    }
    
    onContentChange() {
        if (this.settings.autoSave) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = setTimeout(() => {
                this.saveCurrentNote();
            }, 1000);
        }
        
        this.updatePreview();
        // 延迟设置图片切换按钮，避免频繁更新
        clearTimeout(this.imageToggleTimeout);
        this.imageToggleTimeout = setTimeout(() => {
    
        }, 500);
    }
    
    // UI Updates
    renderNotesList() {
        const notesList = document.getElementById('notesList');
        const workspaceNotes = this.notes.filter(note => note.workspace === this.currentWorkspace);
        
        if (workspaceNotes.length === 0) {
            notesList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无笔记</div>';
            return;
        }
        
        notesList.innerHTML = workspaceNotes.map(note => {
            const preview = note.content.substring(0, 100).replace(/\n/g, ' ');
            const date = new Date(note.updatedAt).toLocaleDateString('zh-CN');
            
            return `
                <div class="note-item" data-note-id="${note.id}" onclick="app.loadNote('${note.id}')">
                    <div class="note-item-title">${note.title}</div>
                    <div class="note-item-preview">${preview}</div>
                    <div class="note-item-date">${date}</div>
                </div>
            `;
        }).join('');
    }
    
    updateActiveNote(noteId) {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-note-id="${noteId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
    
    updatePreview() {
        const content = document.getElementById('editor').value;
        const preview = document.getElementById('preview');
        
        if (!content.trim()) {
            preview.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 40px;">预览将在这里显示</div>';
            return;
        }
        
        try {
            // 在预览时展开图片数据
            const expandedContent = this.processContentForSave(content);
            let html = marked.parse(expandedContent);
            
            // Process math formulas
            html = this.processMathFormulas(html);
            
            // Process code blocks
            html = this.processCodeBlocks(html);
            
            preview.innerHTML = html;
            
            // Highlight code
            preview.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
            
        } catch (error) {
            console.error('Markdown parsing error:', error);
            preview.innerHTML = '<div style="color: #ef4444;">预览解析错误</div>';
        }
    }
    
    // Markdown Processing
    setupMarkdownRenderer() {
        // Create custom renderer for links
        const renderer = new marked.Renderer();
        
        // Override link rendering to open in new tab
        renderer.link = function(href, title, text) {
            const titleAttr = title ? ` title="${title}"` : '';
            
            // Ensure external links have proper protocol
            let finalHref = href;
            if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
                // If it looks like a domain (contains a dot), add https://
                if (href.includes('.') && !href.startsWith('/')) {
                    finalHref = 'https://' + href;
                }
            }
            
            return `<a href="${finalHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        };
        
        marked.setOptions({
            renderer: renderer,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: false,
            gfm: true
        });
    }
    
    processMathFormulas(html) {
        // Process display math ($$...$$)
        html = html.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
            try {
                return katex.renderToString(formula, { displayMode: true });
            } catch (e) {
                return `<span style="color: red;">Math Error: ${e.message}</span>`;
            }
        });
        
        // Process inline math ($...$)
        html = html.replace(/\$([^$]+)\$/g, (match, formula) => {
            try {
                return katex.renderToString(formula, { displayMode: false });
            } catch (e) {
                return `<span style="color: red;">Math Error: ${e.message}</span>`;
            }
        });
        
        return html;
    }
    
    processCodeBlocks(html) {
        // This is handled by marked.js and highlight.js
        return html;
    }
    
    // Markdown Toolbar Actions
    handleMarkdownAction(button) {
        const action = button.dataset.action;
        const editor = document.getElementById('editor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        let replacement = '';
        let cursorOffset = 0;
        
        switch (action) {
            case 'heading':
                const level = button.dataset.level;
                replacement = `${'#'.repeat(level)} ${selectedText || '标题'}`;
                cursorOffset = replacement.length;
                break;
                
            case 'bold':
                replacement = `**${selectedText || '粗体文本'}**`;
                cursorOffset = selectedText ? replacement.length : start + 2;
                break;
                
            case 'italic':
                replacement = `*${selectedText || '斜体文本'}*`;
                cursorOffset = selectedText ? replacement.length : start + 1;
                break;
                
            case 'strikethrough':
                replacement = `~~${selectedText || '删除线文本'}~~`;
                cursorOffset = selectedText ? replacement.length : start + 2;
                break;
                
            case 'code':
                replacement = `\`${selectedText || '代码'}\``;
                cursorOffset = selectedText ? replacement.length : start + 1;
                break;
                
            case 'list':
                const listType = button.dataset.type;
                const lines = (selectedText || '列表项').split('\n');
                if (listType === 'ul') {
                    replacement = lines.map(line => `- ${line}`).join('\n');
                } else {
                    replacement = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
                }
                cursorOffset = replacement.length;
                break;
                
            case 'quote':
                replacement = `> ${selectedText || '引用文本'}`;
                cursorOffset = replacement.length;
                break;
                
            case 'link':
                replacement = `[${selectedText || '链接文本'}](url)`;
                cursorOffset = selectedText ? replacement.length - 4 : start + 1;
                break;
                
            case 'table':
                replacement = `| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |`;
                cursorOffset = replacement.length;
                break;
                
            case 'codeblock':
                replacement = `\`\`\`javascript\n${selectedText || '// 代码块'}\n\`\`\``;
                cursorOffset = selectedText ? replacement.length : start + 13;
                break;
                
            case 'math':
                replacement = `$$\n${selectedText || 'E = mc^2'}\n$$`;
                cursorOffset = selectedText ? replacement.length : start + 3;
                break;
                
            case 'image':
                document.getElementById('imageInput').click();
                return;
                
            case 'drawing':
                this.showDrawingModal();
                return;
                
            case 'file':
                document.getElementById('fileAttachment').click();
                return;
        }
        
        // Insert the replacement text
        const newValue = editor.value.substring(0, start) + replacement + editor.value.substring(end);
        editor.value = newValue;
        
        // Set cursor position
        if (selectedText) {
            editor.setSelectionRange(start + cursorOffset, start + cursorOffset);
        } else {
            editor.setSelectionRange(cursorOffset, cursorOffset);
        }
        
        editor.focus();
        this.onContentChange();
    }
    
    // File Operations
    importNote() {
        document.getElementById('fileInput').click();
    }
    
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件大小，限制为10MB（文本文件可以稍大一些）
        const maxSize = 2 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert(`文件大小超过限制（2MB）。当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const note = {
                id: Date.now().toString(),
                title: file.name.replace(/\.[^/.]+$/, ""),
                content: content,
                workspace: this.currentWorkspace,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.notes.unshift(note);
            this.saveNotes();
            this.renderNotesList();
            this.loadNote(note.id);
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }
    
    handleImageInsert(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件大小，限制为5MB
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert(`图片文件大小超过限制（5MB）。当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const editor = document.getElementById('editor');
            const cursor = editor.selectionStart;
            
            try {
                const imageMarkdown = this.createCollapsibleImage(file.name, dataUrl);
                
                const newValue = editor.value.substring(0, cursor) + imageMarkdown + '\n' + editor.value.substring(cursor);
                editor.value = newValue;
                editor.setSelectionRange(cursor + imageMarkdown.length + 1, cursor + imageMarkdown.length + 1);
                
                this.onContentChange();
            } catch (error) {
                // 如果存储失败，不插入图片
                console.error('图片插入失败:', error);
            }
        };
        
        reader.readAsDataURL(file);
        event.target.value = '';
    }
    
    handleFileAttachment(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件大小，限制为5MB
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert(`文件大小超过限制（5MB）。当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
            event.target.value = '';
            return;
        }
        
        const editor = document.getElementById('editor');
        const cursor = editor.selectionStart;
        
        // 检测文件类型，决定是在线展示还是下载
        const fileType = this.getFileDisplayType(file);
        
        if (fileType.canDisplay) {
            // 浏览器可以直接展示的文件，转换为base64并嵌入
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                let fileMarkdown;
                
                // 在编辑器中统一显示为简化标签，完整数据存储在localStorage中
                const fileId = Date.now().toString();
                const fileData = {type: fileType.type, data: dataUrl, name: file.name, mimeType: file.type};
                
                // 将完整数据存储到localStorage
                const storageKey = `file_data_${fileId}`;
                try {
                    localStorage.setItem(storageKey, JSON.stringify(fileData));
                } catch (error) {
                    if (error.name === 'QuotaExceededError') {
                        alert('存储空间不足，无法保存文件。请清理浏览器缓存或选择较小的文件。');
                        event.target.value = '';
                        return;
                    } else {
                        alert('文件保存失败：' + error.message);
                        event.target.value = '';
                        return;
                    }
                }
                
                // 获取base64数据的最后5个字符用于显示
                const base64Part = dataUrl.split(',')[1] || dataUrl;
                const displayData = base64Part.slice(-5);
                
                fileMarkdown = `<file data-id="${fileId}" data-display="...${displayData}">${file.name}</file>`;
                
                const newValue = editor.value.substring(0, cursor) + fileMarkdown + '\n' + editor.value.substring(cursor);
                editor.value = newValue;
                editor.setSelectionRange(cursor + fileMarkdown.length + 1, cursor + fileMarkdown.length + 1);
                
                this.onContentChange();
            };
            reader.readAsDataURL(file);
        } else {
            // 不能在浏览器中展示的文件，也统一显示为简化标签
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const fileId = Date.now().toString();
                const fileData = {type: 'download', data: dataUrl, name: file.name, mimeType: file.type};
                
                // 将完整数据存储到localStorage
                const storageKey = `file_data_${fileId}`;
                try {
                    localStorage.setItem(storageKey, JSON.stringify(fileData));
                } catch (error) {
                    if (error.name === 'QuotaExceededError') {
                        alert('存储空间不足，无法保存文件。请清理浏览器缓存或选择较小的文件。');
                        event.target.value = '';
                        return;
                    } else {
                        alert('文件保存失败：' + error.message);
                        event.target.value = '';
                        return;
                    }
                }
                
                // 获取base64数据的最后5个字符用于显示
                const base64Part = dataUrl.split(',')[1] || dataUrl;
                const displayData = base64Part.slice(-5);
                
                const fileMarkdown = `<file data-id="${fileId}" data-display="...${displayData}">${file.name}</file>`;
                
                const newValue = editor.value.substring(0, cursor) + fileMarkdown + '\n' + editor.value.substring(cursor);
                editor.value = newValue;
                editor.setSelectionRange(cursor + fileMarkdown.length + 1, cursor + fileMarkdown.length + 1);
                
                this.onContentChange();
            };
            reader.readAsDataURL(file);
        }
        
        event.target.value = '';
    }

    getFileDisplayType(file) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        // 音频文件
        if (fileType.startsWith('audio/') || 
            fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
            return { canDisplay: true, type: 'audio' };
        }
        
        // 视频文件
        if (fileType.startsWith('video/') || 
            fileName.match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)$/)) {
            return { canDisplay: true, type: 'video' };
        }
        
        // PDF文件
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return { canDisplay: true, type: 'pdf' };
        }
        
        // 图片文件（虽然已经有专门的图片处理，但这里也支持）
        if (fileType.startsWith('image/') || 
            fileName.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)) {
            return { canDisplay: true, type: 'image' };
        }
        
        // 文本文件
        if (fileType.startsWith('text/') || 
            fileName.match(/\.(txt|md|json|xml|csv|log)$/)) {
            return { canDisplay: true, type: 'text' };
        }
        
        // HTML文件
        if (fileType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
            return { canDisplay: true, type: 'html' };
        }
        
        // 其他文件类型默认为下载
        return { canDisplay: false, type: 'download' };
    }

    // Export Functions
    exportToPDF() {
        if (!this.currentNote) return;
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const preview = document.getElementById('preview');
        
        // 使用 html2canvas 将预览内容转换为图片，然后插入 PDF
        // 这样可以保持所有格式和中文字符
        html2canvas(preview, {
            scale: 2,
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 190; // PDF 页面宽度减去边距
            const pageHeight = 297; // A4 页面高度
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 10;
            
            // 添加第一页
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight - 20; // 减去上下边距
            
            // 如果内容超过一页，添加更多页面
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight + 10;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            // 保存 PDF，使用安全的文件名
            const safeTitle = this.currentNote.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            pdf.save(`${safeTitle}.pdf`);
        }).catch(error => {
            console.error('PDF 导出失败:', error);
            alert('PDF 导出失败，请重试');
        });
    }
    
    exportToHTML() {
        if (!this.currentNote) return;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.currentNote.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1, h2, h3 { color: #333; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    </style>
</head>
<body>
    ${marked.parse(this.currentNote.content)}
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 使用安全的文件名，避免特殊字符导致的问题
        const safeTitle = this.currentNote.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        a.download = `${safeTitle}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    exportToImage() {
        if (!this.currentNote) return;
        
        const preview = document.getElementById('preview');
        html2canvas(preview, {
            scale: 2,
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            const link = document.createElement('a');
            // 使用安全的文件名，避免特殊字符导致的问题
            const safeTitle = this.currentNote.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            link.download = `${safeTitle}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('图片导出失败:', error);
            alert('图片导出失败，请重试');
        });
    }
    
    // UI Controls
    togglePreview() {
        this.isPreviewMode = !this.isPreviewMode;
        const editorPane = document.getElementById('editorPane');
        const previewPane = document.getElementById('previewPane');
        const toggleBtn = document.getElementById('togglePreview');
        
        if (window.innerWidth <= 768) {
            // Mobile behavior: toggle between editor and preview
            if (this.isPreviewMode) {
                editorPane.style.display = 'none';
                previewPane.classList.add('show');
                previewPane.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑';
                toggleBtn.title = '切换到编辑模式';
            } else {
                editorPane.style.display = 'flex';
                previewPane.classList.remove('show');
                previewPane.style.display = 'none';
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i> 预览';
                toggleBtn.title = '切换到预览模式';
            }
        } else {
            // Desktop behavior: show/hide preview pane
            if (this.isPreviewMode) {
                editorPane.style.display = 'none';
                previewPane.style.flex = '1';
                previewPane.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-edit"></i>';
                toggleBtn.title = '显示编辑器';
            } else {
                editorPane.style.display = 'flex';
                previewPane.style.flex = '1';
                previewPane.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
                toggleBtn.title = '隐藏预览';
            }
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    syncScroll() {
        // Sync scroll between editor and preview
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
    }
    
    // Settings
    showSettings() {
        const modal = document.getElementById('settingsModal');
        document.getElementById('themeSelect').value = this.settings.theme;
        document.getElementById('fontSizeSlider').value = this.settings.fontSize;
        document.getElementById('fontSizeValue').textContent = this.settings.fontSize + 'px';
        document.getElementById('autoSave').checked = this.settings.autoSave;
        document.getElementById('aiEnabled').checked = this.settings.aiEnabled;
        document.getElementById('aiApiKey').value = this.settings.aiApiKey;
        document.getElementById('aiBaseUrl').value = this.settings.aiBaseUrl;
        document.getElementById('aiModel').value = this.settings.aiModel;
        modal.classList.add('show');
    }
    
    changeTheme(theme) {
        this.settings.theme = theme;
        this.saveSettings();
        this.applySettings();
    }
    
    changeFontSize(size) {
        this.settings.fontSize = parseInt(size);
        document.getElementById('fontSizeValue').textContent = size + 'px';
        this.saveSettings();
        this.applySettings();
    }
    
    toggleAutoSave(enabled) {
        this.settings.autoSave = enabled;
        this.saveSettings();
    }
    
    toggleAI(enabled) {
        this.settings.aiEnabled = enabled;
        this.saveSettings();
    }
    
    updateAISetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }
    
    applySettings() {
        document.body.className = this.settings.theme;
        document.getElementById('editor').style.fontSize = this.settings.fontSize + 'px';
        document.getElementById('preview').style.fontSize = this.settings.fontSize + 'px';
    }
    
    // Workspace Management
    switchWorkspace(workspace) {
        this.currentWorkspace = workspace;
        localStorage.setItem('currentWorkspace', workspace);
        this.renderNotesList();
        
        // Load first note in new workspace
        const workspaceNotes = this.notes.filter(note => note.workspace === workspace);
        if (workspaceNotes.length > 0) {
            this.loadNote(workspaceNotes[0].id);
        } else {
            this.currentNote = null;
            document.getElementById('noteTitle').value = '';
            document.getElementById('editor').value = '';
            this.updatePreview();
        }
    }
    
    createWorkspace() {
        const name = prompt('请输入工作区名称:');
        if (name && name.trim()) {
            const workspaceName = name.trim();
            
            // 检查工作区是否已存在
            if (this.workspaces.includes(workspaceName)) {
                alert('工作区已存在！');
                return;
            }
            
            // 添加到工作区列表
            this.workspaces.push(workspaceName);
            
            // 保存工作区列表到localStorage
            localStorage.setItem('workspaces', JSON.stringify(this.workspaces));
            
            // 重新加载工作区选择器
            this.loadWorkspace();
            
            // 切换到新工作区
            this.switchWorkspace(workspaceName);
        }
    }
    
    loadWorkspace() {
        const select = document.getElementById('workspaceSelect');
        
        // 清空现有选项
        select.innerHTML = '';
        
        // 添加所有保存的工作区
        this.workspaces.forEach(workspace => {
            const option = document.createElement('option');
            option.value = workspace;
            option.textContent = workspace === 'public' ? '公共工作区' : 
                               workspace === 'private' ? '私人工作区' : workspace;
            select.appendChild(option);
        });
        
        // 设置当前工作区
        select.value = this.currentWorkspace;
    }
    
    // Templates
    showTemplateModal() {
        const modal = document.getElementById('templateModal');
        const grid = document.getElementById('templateGrid');
        
        const templates = [
            { id: 'blank', name: '空白笔记', icon: 'fas fa-file', description: '从空白开始' },
            { id: 'meeting', name: '会议记录', icon: 'fas fa-users', description: '会议纪要模板' },
            { id: 'todo', name: '待办清单', icon: 'fas fa-tasks', description: '任务管理模板' },
            { id: 'journal', name: '日记', icon: 'fas fa-book', description: '日记模板' },
            { id: 'project', name: '项目计划', icon: 'fas fa-project-diagram', description: '项目规划模板' },
            { id: 'research', name: '研究笔记', icon: 'fas fa-microscope', description: '学术研究模板' }
        ];
        
        grid.innerHTML = templates.map(template => `
            <div class="template-item" onclick="app.createFromTemplate('${template.id}')">
                <i class="${template.icon}"></i>
                <h4>${template.name}</h4>
                <p>${template.description}</p>
            </div>
        `).join('');
        
        modal.classList.add('show');
    }
    
    createFromTemplate(templateId) {
        const templates = {
            blank: { title: '无标题', content: '' },
            meeting: {
                title: '会议记录 - ' + new Date().toLocaleDateString(),
                content: `# 会议记录\n\n**日期:** ${new Date().toLocaleDateString()}\n**时间:** \n**参与者:** \n\n## 议程\n\n- [ ] 议题1\n- [ ] 议题2\n- [ ] 议题3\n\n## 讨论要点\n\n\n\n## 决议事项\n\n\n\n## 后续行动\n\n- [ ] 行动项1 - 负责人: \n- [ ] 行动项2 - 负责人: \n`
            },
            todo: {
                title: '待办清单 - ' + new Date().toLocaleDateString(),
                content: `# 待办清单\n\n## 今日任务\n\n- [ ] 任务1\n- [ ] 任务2\n- [ ] 任务3\n\n## 本周计划\n\n- [ ] 计划1\n- [ ] 计划2\n\n## 长期目标\n\n- [ ] 目标1\n- [ ] 目标2\n`
            },
            journal: {
                title: '日记 - ' + new Date().toLocaleDateString(),
                content: `# ${new Date().toLocaleDateString()} 日记\n\n## 今日感想\n\n\n\n## 重要事件\n\n\n\n## 明日计划\n\n- [ ] \n- [ ] \n- [ ] \n`
            },
            project: {
                title: '项目计划',
                content: `# 项目计划\n\n## 项目概述\n\n**项目名称:** \n**开始日期:** \n**预计完成:** \n**项目负责人:** \n\n## 项目目标\n\n\n\n## 主要里程碑\n\n- [ ] 里程碑1 - 日期: \n- [ ] 里程碑2 - 日期: \n- [ ] 里程碑3 - 日期: \n\n## 资源需求\n\n\n\n## 风险评估\n\n\n`
            },
            research: {
                title: '研究笔记',
                content: `# 研究笔记\n\n## 研究主题\n\n\n\n## 研究问题\n\n\n\n## 文献综述\n\n\n\n## 研究方法\n\n\n\n## 数据分析\n\n\n\n## 结论\n\n\n\n## 参考文献\n\n1. \n2. \n3. \n`
            }
        };
        
        const template = templates[templateId];
        if (template) {
            const note = {
                id: Date.now().toString(),
                title: template.title,
                content: template.content,
                workspace: this.currentWorkspace,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.notes.unshift(note);
            this.saveNotes();
            this.renderNotesList();
            this.loadNote(note.id);
        }
        
        document.getElementById('templateModal').classList.remove('show');
    }
    
    // Drawing Canvas
    setupDrawingCanvas() {
        this.canvas = new fabric.Canvas('drawingCanvas');
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.width = 2;
        this.canvas.freeDrawingBrush.color = '#000000';
        
        // Drawing controls
        document.getElementById('drawingPen').addEventListener('click', () => {
            this.canvas.isDrawingMode = true;
            document.getElementById('drawingPen').classList.add('active');
            document.getElementById('drawingEraser').classList.remove('active');
        });
        
        document.getElementById('drawingEraser').addEventListener('click', () => {
            this.canvas.isDrawingMode = false;
            document.getElementById('drawingEraser').classList.add('active');
            document.getElementById('drawingPen').classList.remove('active');
        });
        
        document.getElementById('drawingColor').addEventListener('change', (e) => {
            this.canvas.freeDrawingBrush.color = e.target.value;
        });
        
        document.getElementById('drawingSize').addEventListener('input', (e) => {
            this.canvas.freeDrawingBrush.width = parseInt(e.target.value);
        });
        
        document.getElementById('drawingClear').addEventListener('click', () => {
            this.canvas.clear();
        });
        
        document.getElementById('drawingSave').addEventListener('click', () => {
            this.saveDrawing();
        });
    }
    
    showDrawingModal() {
        document.getElementById('drawingModal').classList.add('show');
        setTimeout(() => {
            this.canvas.setDimensions({
                width: document.getElementById('drawingCanvas').offsetWidth,
                height: 600
            });
        }, 100);
    }
    
    saveDrawing() {
        const dataURL = this.canvas.toDataURL('image/png');
        const editor = document.getElementById('editor');
        const cursor = editor.selectionStart;
        
        try {
            const imageMarkdown = this.createCollapsibleImage('绘图', dataURL);
            
            const newValue = editor.value.substring(0, cursor) + imageMarkdown + '\n' + editor.value.substring(cursor);
            editor.value = newValue;
            editor.setSelectionRange(cursor + imageMarkdown.length + 1, cursor + imageMarkdown.length + 1);
            
            this.onContentChange();
        } catch (error) {
            // 如果存储失败，不插入绘图
            console.error('绘图保存失败:', error);
        }
        
        document.getElementById('drawingModal').classList.remove('show');
    }
    
    // Image Helper Functions
    createCollapsibleImage(fileName, dataUrl) {
        const id = Date.now().toString();
        
        // 将完整的base64数据存储到localStorage
        const storageKey = `image_data_${id}`;
        try {
            localStorage.setItem(storageKey, dataUrl);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                alert('存储空间不足，无法保存图片。请清理浏览器缓存或选择较小的图片。');
                throw error; // 重新抛出错误，让调用者处理
            } else {
                alert('图片保存失败：' + error.message);
                throw error;
            }
        }
        
        // 获取base64数据的最后5个字符用于显示
        const base64Part = dataUrl.split(',')[1] || dataUrl;
        const displayData = base64Part.slice(-5);
        
        // 根据文件名判断是否为画板
        if (fileName === '绘图' || fileName.includes('画板') || fileName.includes('绘图')) {
            return `<draw data-id="${id}" data-display="...${displayData}"></draw>`;
        } else {
            return `<image data-id="${id}" data-display="...${displayData}">${fileName}</image>`;
        }
    }
    
    expandImageData(content) {
        // 处理图片和绘图标签
        content = content.replace(/<(draw|image)[^>]*>([^<]*)<\/(draw|image)>/g, (imageBlock) => {
            // 处理新的data属性格式
            if (imageBlock.includes('<draw')) {
                // 先尝试从localStorage获取数据
                const idMatch = imageBlock.match(/data-id="([^"]+)"/);  
                if (idMatch) {
                    const storageKey = `image_data_${idMatch[1]}`;
                    const storedData = localStorage.getItem(storageKey);
                    if (storedData) {
                        return `![绘图](${storedData})`;
                    }
                }
                
                // 兼容旧格式
                const urlMatch = imageBlock.match(/data-url="([^"]+)"/); 
                if (urlMatch) {
                    return `![绘图](${urlMatch[1]})`;
                }
            } else if (imageBlock.includes('<image')) {
                // 先尝试从localStorage获取数据
                const idMatch = imageBlock.match(/data-id="([^"]+)"/);  
                if (idMatch) {
                    const storageKey = `image_data_${idMatch[1]}`;
                    const storedData = localStorage.getItem(storageKey);
                    if (storedData) {
                        const nameMatch = imageBlock.match(/<image[^>]*>([^<]*)<\/image>/);
                        const fileName = nameMatch ? nameMatch[1] : '图片';
                        return `![${fileName}](${storedData})`;
                    }
                }
                
                // 兼容旧格式
                const urlMatch = imageBlock.match(/data-url="([^"]+)"/); 
                const nameMatch = imageBlock.match(/<image[^>]*>([^<]*)<\/image>/);
                if (urlMatch) {
                    const fileName = nameMatch ? nameMatch[1] : '图片';
                    return `![${fileName}](${urlMatch[1]})`;
                }
            }
            
            // 兼容旧格式
            const imageDataMatch = imageBlock.match(/<!-- IMAGE_DATA_\d+:(.*?) -->/);
            if (imageDataMatch) {
                const dataUrl = imageDataMatch[1];
                if (imageBlock.includes('<draw>')) {
                    return `![绘图](${dataUrl})`;
                } else if (imageBlock.includes('<image>')) {
                    const nameMatch = imageBlock.match(/<image>(.*?)<\/image>/);
                    const fileName = nameMatch ? nameMatch[1] : '图片';
                    return `![${fileName}](${dataUrl})`;
                }
            }
            
            const fullDataMatch = imageBlock.match(/<!-- FULL_DATA: (.*?) -->/);
            if (fullDataMatch) {
                const fullData = fullDataMatch[1];
                const fileNameMatch = imageBlock.match(/!\[(.*?)\]/);
                const fileName = fileNameMatch ? fileNameMatch[1] : '图片';
                return `![${fileName}](${fullData})`;
            }
            return imageBlock;
        });
        
        // 处理文件标签 - 将其展开为相应的HTML元素以便在预览中显示
        content = content.replace(/<file[^>]*data-id="([^"]+)"[^>]*>([^<]*)<\/file>/g, (fileBlock, dataId, fileName) => {
            const storageKey = `file_data_${dataId}`;
            const storedData = localStorage.getItem(storageKey);
            if (storedData) {
                try {
                    const fileData = JSON.parse(storedData);
                    const { type, data, mimeType } = fileData;
                    
                    if (type === 'audio') {
                        return `<audio controls><source src="${data}" type="${mimeType}">您的浏览器不支持音频播放。</audio>`;
                    } else if (type === 'video') {
                        return `<video controls style="max-width: 100%; height: auto;"><source src="${data}" type="${mimeType}">您的浏览器不支持视频播放。</video>`;
                    } else if (type === 'pdf') {
                        return `<embed src="${data}" type="application/pdf" width="100%" height="600px" />`;
                    } else if (type === 'html') {
                        return `<iframe src="${data}" style="width: 100%; height: 400px; border: 1px solid #ccc;"></iframe>`;
                    } else if (type === 'text') {
                        return `<iframe src="${data}" style="width: 100%; height: 300px; border: 1px solid #ccc;"></iframe>`;
                    } else {
                        // 其他类型文件显示下载链接
                        return `<a href="${data}" download="${fileName}" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">📎 下载 ${fileName}</a>`;
                    }
                } catch (e) {
                    console.error('解析文件数据失败:', e);
                }
            }
            return fileBlock;
        });
        
        return content;
    }
    
    collapseImageData(content) {
        // 将完整的 base64 图片转换为收起格式，但不处理已经收起的图片
        content = content.replace(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]{100,})\)(?! data-)/g, (match, fileName, dataUrl) => {
            return this.createCollapsibleImage(fileName, dataUrl);
        });
        
        // 注意：文件标签(<file>)不应该被收起，它们应该始终保持展开状态以便用户访问
        
        // 将完整的文件HTML标签转换为简化标签
        content = content.replace(/<audio[^>]*>.*?<\/audio>/gs, (match) => {
            const srcMatch = match.match(/src="([^"]+)"/); 
            const typeMatch = match.match(/type="([^"]+)"/); 
            if (srcMatch) {
                const fileId = Date.now().toString();
                const fileName = '音频文件';
                const fileData = {type: 'audio', data: srcMatch[1], name: fileName, mimeType: typeMatch ? typeMatch[1] : 'audio/*'};
                
                // 存储到localStorage
                const storageKey = `file_data_${fileId}`;
                localStorage.setItem(storageKey, JSON.stringify(fileData));
                
                // 获取base64数据的最后5个字符用于显示
                const base64Part = srcMatch[1].split(',')[1] || srcMatch[1];
                const displayData = base64Part.slice(-5);
                
                return `<file data-id="${fileId}" data-display="...${displayData}">${fileName}</file>`;
            }
            return match;
        });
        
        content = content.replace(/<video[^>]*>.*?<\/video>/gs, (match) => {
            const srcMatch = match.match(/src="([^"]+)"/); 
            const typeMatch = match.match(/type="([^"]+)"/); 
            if (srcMatch) {
                const fileId = Date.now().toString();
                const fileName = '视频文件';
                const fileData = {type: 'video', data: srcMatch[1], name: fileName, mimeType: typeMatch ? typeMatch[1] : 'video/*'};
                
                // 存储到localStorage
                const storageKey = `file_data_${fileId}`;
                localStorage.setItem(storageKey, JSON.stringify(fileData));
                
                // 获取base64数据的最后5个字符用于显示
                const base64Part = srcMatch[1].split(',')[1] || srcMatch[1];
                const displayData = base64Part.slice(-5);
                
                return `<file data-id="${fileId}" data-display="...${displayData}">${fileName}</file>`;
            }
            return match;
        });
        
        content = content.replace(/<embed[^>]*src="([^"]+)"[^>]*>/g, (match, src) => {
            const fileId = Date.now().toString();
            const fileName = 'PDF文件';
            const fileData = {type: 'pdf', data: src, name: fileName, mimeType: 'application/pdf'};
            
            // 存储到localStorage
            const storageKey = `file_data_${fileId}`;
            localStorage.setItem(storageKey, JSON.stringify(fileData));
            
            // 获取base64数据的最后5个字符用于显示
            const base64Part = src.split(',')[1] || src;
            const displayData = base64Part.slice(-5);
            
            return `<file data-id="${fileId}" data-display="...${displayData}">${fileName}</file>`;
        });
        
        content = content.replace(/<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/g, (match, src) => {
            const fileId = Date.now().toString();
            const fileName = '文档文件';
            const type = src.includes('data:text/html') ? 'html' : 'text';
            const fileData = {type: type, data: src, name: fileName, mimeType: type === 'html' ? 'text/html' : 'text/plain'};
            
            // 存储到localStorage
            const storageKey = `file_data_${fileId}`;
            localStorage.setItem(storageKey, JSON.stringify(fileData));
            
            // 获取base64数据的最后5个字符用于显示
            const base64Part = src.split(',')[1] || src;
            const displayData = base64Part.slice(-5);
            
            return `<file data-id="${fileId}" data-display="...${displayData}">${fileName}</file>`;
        });
        
        return content;
    }
    
    // Editor Click Handler
    handleEditorClick(event) {
        const editor = document.getElementById('editor');
        const cursorPos = editor.selectionStart;
        const content = editor.value;
        
        // 查找点击位置前后的内容，精确定位标签
        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);
        
        // 查找收起状态的标签
        const collapsedPatterns = [
            /<draw[^>]*data-id="([^"]+)"[^>]*>([^<]*)<\/draw>/g,
            /<img[^>]*data-id="([^"]+)"[^>]*alt="([^"]*)"/g,
            /<file[^>]*data-id="([^"]+)"[^>]*>([^<]*)<\/file>/g
        ];
        
        // 查找展开状态的标签
        const expandedPatterns = [
            /!\[绘图\]\((data:image\/[^)]+)\)/g,
            /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g,
            /<audio[^>]*>.*?<\/audio>/gs,
            /<video[^>]*>.*?<\/video>/gs,
            /<embed[^>]*src="(data:[^"]+)"[^>]*\/?>/g,
            /<iframe[^>]*src="(data:[^"]+)"[^>]*><\/iframe>/g
        ];
        
        let clickedTag = null;
        let tagStart = -1;
        let tagEnd = -1;
        let isExpanded = false;
        
        // 首先检查是否点击了收起状态的标签
        for (const pattern of collapsedPatterns) {
            const matches = [...content.matchAll(pattern)];
            for (const match of matches) {
                const matchStart = match.index;
                const matchEnd = match.index + match[0].length;
                
                if (cursorPos >= matchStart && cursorPos <= matchEnd) {
                    clickedTag = match;
                    tagStart = matchStart;
                    tagEnd = matchEnd;
                    isExpanded = false;
                    break;
                }
            }
            if (clickedTag) break;
        }
        
        // 如果没有找到收起状态的标签，检查展开状态的标签
        if (!clickedTag) {
            for (const pattern of expandedPatterns) {
                const matches = [...content.matchAll(pattern)];
                for (const match of matches) {
                    const matchStart = match.index;
                    const matchEnd = match.index + match[0].length;
                    
                    if (cursorPos >= matchStart && cursorPos <= matchEnd) {
                        clickedTag = match;
                        tagStart = matchStart;
                        tagEnd = matchEnd;
                        isExpanded = true;
                        break;
                    }
                }
                if (clickedTag) break;
            }
        }
        
        if (!clickedTag) return; // 没有点击到标签，不处理
        
        const fullMatch = clickedTag[0];
        
        if (!isExpanded) {
            // 展开收起状态的标签
            if (fullMatch.includes('<draw')) {
                const dataId = clickedTag[1];
                const storageKey = `image_data_${dataId}`;
                const dataUrl = localStorage.getItem(storageKey);
                if (dataUrl) {
                    const newContent = content.substring(0, tagStart) + `![绘图](${dataUrl})` + content.substring(tagEnd);
                    editor.value = newContent;
                    this.onContentChange();
                }
            } else if (fullMatch.includes('<img')) {
                const dataId = clickedTag[1];
                const fileName = clickedTag[2] || '图片';
                const storageKey = `image_data_${dataId}`;
                const dataUrl = localStorage.getItem(storageKey);
                if (dataUrl) {
                    const newContent = content.substring(0, tagStart) + `![${fileName}](${dataUrl})` + content.substring(tagEnd);
                    editor.value = newContent;
                    this.onContentChange();
                }
            } else if (fullMatch.includes('<file')) {
                const dataId = clickedTag[1];
                const fileName = clickedTag[2];
                const storageKey = `file_data_${dataId}`;
                const fileDataStr = localStorage.getItem(storageKey);
                if (fileDataStr) {
                    const fileData = JSON.parse(fileDataStr);
                    let newLine;
                    
                    if (fileData.type === 'audio') {
                        newLine = `<audio controls>\n  <source src="${fileData.data}" type="${fileData.mimeType}">\n  您的浏览器不支持音频播放。\n</audio>`;
                    } else if (fileData.type === 'video') {
                        newLine = `<video controls width="100%" style="max-width: 600px;">\n  <source src="${fileData.data}" type="${fileData.mimeType}">\n  您的浏览器不支持视频播放。\n</video>`;
                    } else if (fileData.type === 'pdf') {
                        newLine = `<embed src="${fileData.data}" type="application/pdf" width="100%" height="600px" />`;
                    } else if (fileData.type === 'text') {
                        newLine = `<iframe src="${fileData.data}" width="100%" height="400px" style="border: 1px solid #ccc;"></iframe>`;
                    } else if (fileData.type === 'html') {
                        newLine = `<iframe src="${fileData.data}" width="100%" height="500px" style="border: 1px solid #ccc;"></iframe>`;
                    } else {
                        newLine = `[📎 ${fileName}](${fileData.data} "点击下载")`;
                    }
                    
                    const newContent = content.substring(0, tagStart) + newLine + content.substring(tagEnd);
                    editor.value = newContent;
                    this.onContentChange();
                }
            }
        } else {
            // 收起展开状态的标签
            if (fullMatch.includes('![绘图]')) {
                const dataUrl = clickedTag[1];
                const dataId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                const storageKey = `image_data_${dataId}`;
                localStorage.setItem(storageKey, dataUrl);
                
                const base64Part = dataUrl.split(',')[1] || dataUrl;
                const displayData = base64Part.slice(-5);
                const newContent = content.substring(0, tagStart) + `<draw data-id="${dataId}" data-display="...${displayData}">绘图</draw>` + content.substring(tagEnd);
                editor.value = newContent;
                this.onContentChange();
            } else if (fullMatch.includes('![') && fullMatch.includes('](data:image/')) {
                const fileName = clickedTag[1] || '图片';
                const dataUrl = clickedTag[2];
                const dataId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                const storageKey = `image_data_${dataId}`;
                localStorage.setItem(storageKey, dataUrl);
                
                const base64Part = dataUrl.split(',')[1] || dataUrl;
                const displayData = base64Part.slice(-5);
                const newContent = content.substring(0, tagStart) + `<img data-id="${dataId}" data-display="...${displayData}" alt="${fileName}" />` + content.substring(tagEnd);
                editor.value = newContent;
                this.onContentChange();
            } else if (fullMatch.includes('<audio') || fullMatch.includes('<video') || fullMatch.includes('<embed') || fullMatch.includes('<iframe')) {
                // 处理音频、视频、PDF、HTML/文本文件的收起
                let dataUrl, fileName, fileType;
                
                if (fullMatch.includes('<audio')) {
                    const srcMatch = fullMatch.match(/src="([^"]+)"/);
                    dataUrl = srcMatch ? srcMatch[1] : '';
                    fileName = '音频文件';
                    fileType = 'audio';
                } else if (fullMatch.includes('<video')) {
                    const srcMatch = fullMatch.match(/src="([^"]+)"/);
                    dataUrl = srcMatch ? srcMatch[1] : '';
                    fileName = '视频文件';
                    fileType = 'video';
                } else if (fullMatch.includes('<embed')) {
                    const srcMatch = fullMatch.match(/src="([^"]+)"/);
                    dataUrl = srcMatch ? srcMatch[1] : '';
                    fileName = 'PDF文件';
                    fileType = 'pdf';
                } else if (fullMatch.includes('<iframe')) {
                    const srcMatch = fullMatch.match(/src="([^"]+)"/);
                    dataUrl = srcMatch ? srcMatch[1] : '';
                    fileName = '文档文件';
                    fileType = dataUrl.includes('data:text/html') ? 'html' : 'text';
                }
                
                if (dataUrl) {
                    const dataId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    const storageKey = `file_data_${dataId}`;
                    const fileData = {
                        type: fileType,
                        data: dataUrl,
                        name: fileName,
                        mimeType: fileType === 'audio' ? 'audio/*' : fileType === 'video' ? 'video/*' : fileType === 'pdf' ? 'application/pdf' : fileType === 'html' ? 'text/html' : 'text/plain'
                    };
                    localStorage.setItem(storageKey, JSON.stringify(fileData));
                    
                    const base64Part = dataUrl.split(',')[1] || dataUrl;
                    const displayData = base64Part.slice(-5);
                    const newContent = content.substring(0, tagStart) + `<file data-id="${dataId}" data-display="...${displayData}">${fileName}</file>` + content.substring(tagEnd);
                    editor.value = newContent;
                    this.onContentChange();
                }
            }
        }
    }
    
    // Keyboard Shortcuts
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    event.preventDefault();
                    this.saveCurrentNote();
                    break;
                case 'n':
                    event.preventDefault();
                    this.createNote();
                    break;
                case 'p':
                    event.preventDefault();
                    this.togglePreview();
                    break;
                case 'b':
                    if (document.activeElement.id === 'editor') {
                        event.preventDefault();
                        this.handleMarkdownAction({ dataset: { action: 'bold' } });
                    }
                    break;
                case 'i':
                    if (document.activeElement.id === 'editor') {
                        event.preventDefault();
                        this.handleMarkdownAction({ dataset: { action: 'italic' } });
                    }
                    break;
            }
        }
    }
    
    handleResize() {
        // Handle responsive design
        const sidebar = document.querySelector('.sidebar');
        const editorPane = document.getElementById('editorPane');
        const previewPane = document.getElementById('previewPane');
        const toggleBtn = document.getElementById('togglePreview');
        
        if (window.innerWidth <= 768) {
            // Mobile layout
            sidebar.classList.remove('open');
            
            if (this.isPreviewMode) {
                editorPane.style.display = 'none';
                previewPane.style.display = 'block';
                previewPane.classList.add('show');
                toggleBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑';
            } else {
                editorPane.style.display = 'flex';
                previewPane.style.display = 'none';
                previewPane.classList.remove('show');
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i> 预览';
            }
        } else {
            // Desktop layout
            sidebar.classList.remove('open');
            editorPane.style.display = 'flex';
            previewPane.style.display = 'block';
            previewPane.style.flex = '1';
            previewPane.classList.remove('show');
            
            // Reset preview mode for desktop
            if (this.isPreviewMode) {
                toggleBtn.innerHTML = '<i class="fas fa-edit"></i>';
            } else {
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        }
        
        // Remove any overlay that might exist
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        sidebar.classList.toggle('open');
        
        // Create overlay if it doesn't exist
        if (!overlay && sidebar.classList.contains('open')) {
            const newOverlay = document.createElement('div');
            newOverlay.className = 'sidebar-overlay';
            newOverlay.addEventListener('click', () => this.toggleSidebar());
            document.body.appendChild(newOverlay);
        } else if (overlay && !sidebar.classList.contains('open')) {
            overlay.remove();
        }
        
        // Prevent body scroll when sidebar is open on mobile
        if (window.innerWidth <= 768) {
            if (sidebar.classList.contains('open')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    }
    
    setupTouchEvents() {
        let startX = 0;
        let startY = 0;
        let isScrolling = false;
        
        // Swipe to open/close sidebar
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isScrolling = false;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = startX - currentX;
            const diffY = startY - currentY;
            
            // Determine if user is scrolling vertically
            if (Math.abs(diffY) > Math.abs(diffX)) {
                isScrolling = true;
                return;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY || isScrolling) {
                startX = 0;
                startY = 0;
                return;
            }
            
            const endX = e.changedTouches[0].clientX;
            const diffX = startX - endX;
            const sidebar = document.querySelector('.sidebar');
            
            // Only handle swipes on mobile
            if (window.innerWidth <= 768) {
                // Swipe right to open (from left edge)
                if (diffX < -50 && startX < 50 && !sidebar.classList.contains('open')) {
                    this.toggleSidebar();
                }
                // Swipe left to close
                else if (diffX > 50 && sidebar.classList.contains('open')) {
                    this.toggleSidebar();
                }
            }
            
            startX = 0;
            startY = 0;
        }, { passive: true });
    }
    
    // Content Processing
    processContentForSave(content) {
        // 展开所有图片和绘图数据
        return this.expandImageData(content);
    }
    
    processContentForDisplay(content) {
        // 在显示时收起图片数据
        return this.collapseImageData(content);
    }
    
    // Image Toggle Handlers

    

    

    

    
    toggleElementData(editor, elementBlock, fileName, dataId, type) {
        const content = editor.value;
        
        // 从localStorage获取完整数据
        const storageKey = type === 'file' ? `file_data_${dataId}` : `image_data_${dataId}`;
        const storedData = localStorage.getItem(storageKey);
        
        if (storedData) {
            let expandedContent;
            
            if (type === 'file') {
                // 展开文件
                try {
                    const fileData = JSON.parse(storedData);
                    const { type: fileType, data, mimeType } = fileData;
                    
                    if (fileType === 'audio') {
                        expandedContent = `<audio controls><source src="${data}" type="${mimeType}">您的浏览器不支持音频播放。</audio>`;
                    } else if (fileType === 'video') {
                        expandedContent = `<video controls style="max-width: 100%; height: auto;"><source src="${data}" type="${mimeType}">您的浏览器不支持视频播放。</video>`;
                    } else if (fileType === 'pdf') {
                        expandedContent = `<embed src="${data}" type="application/pdf" width="100%" height="600px" />`;
                    } else if (fileType === 'html') {
                        expandedContent = `<iframe src="${data}" style="width: 100%; height: 400px; border: 1px solid #ccc;"></iframe>`;
                    } else if (fileType === 'text') {
                        expandedContent = `<iframe src="${data}" style="width: 100%; height: 300px; border: 1px solid #ccc;"></iframe>`;
                    } else {
                        expandedContent = `<a href="${data}" download="${fileName}" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">📎 下载 ${fileName}</a>`;
                    }
                } catch (e) {
                    console.error('解析文件数据失败:', e);
                    return;
                }
            } else {
                // 展开图片或绘图
                if (type === 'draw') {
                    expandedContent = `![绘图](${storedData})`;
                } else {
                    expandedContent = `![${fileName}](${storedData})`;
                }
            }
            
            const newContent = content.replace(elementBlock, expandedContent);
            editor.value = newContent;
            
            this.onContentChange();
    
        }
    }
    
    toggleImageData(editor, imageBlock, fileName, fullData, id) {
        const content = editor.value;
        const isCollapsed = imageBlock.includes('base64数据已收起');
        
        if (isCollapsed) {
            // 展开图片
            const expandedImage = `![${fileName}](${fullData})`;
            const newContent = content.replace(imageBlock, expandedImage);
            editor.value = newContent;
        } else {
            // 收起图片
            const collapsedImage = this.createCollapsibleImage(fileName, fullData);
            const newContent = content.replace(imageBlock, collapsedImage);
            editor.value = newContent;
        }
        
        this.onContentChange();

    }
    
    // Data Persistence
    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }
    
    saveWorkspaces() {
        localStorage.setItem('workspaces', JSON.stringify(this.workspaces));
    }
    
    saveSettings() {
        localStorage.setItem('settings', JSON.stringify(this.settings));
    }
    
    // AI Functions
    handleAITrigger(e) {
        if (!this.settings.aiEnabled) return;
        
        const editor = document.getElementById('editor');
        const text = editor.value;
        const cursorPos = editor.selectionStart;
        
        // Check for @chat or @writer triggers when Tab is pressed
        if (e.key === 'Tab') {
            const beforeCursor = text.substring(0, cursorPos);
            const lines = beforeCursor.split('\n');
            const currentLine = lines[lines.length - 1];
            
            if (currentLine.trim() === '@chat') {
                e.preventDefault(); // Prevent default tab behavior
                // Remove the @chat text
                const newText = text.substring(0, cursorPos - 5) + text.substring(cursorPos);
                editor.value = newText;
                const newCursorPos = cursorPos - 5;
                editor.setSelectionRange(newCursorPos, newCursorPos);
                this.onContentChange(); // Sync with preview
                this.showAIChatDialog(newCursorPos);
            } else if (currentLine.trim() === '@writer') {
                e.preventDefault(); // Prevent default tab behavior
                // Remove the @writer text
                const newText = text.substring(0, cursorPos - 7) + text.substring(cursorPos);
                editor.value = newText;
                const newCursorPos = cursorPos - 7;
                editor.setSelectionRange(newCursorPos, newCursorPos);
                this.onContentChange(); // Sync with preview
                this.showAIWriterDialog(newCursorPos);
            }
        }
    }
    
    showAIChatDialog(cursorPos) {
        const dialog = this.createAIDialog('chat', cursorPos);
        document.body.appendChild(dialog);
    }
    
    showAIWriterDialog(cursorPos) {
        const dialog = this.createAIDialog('writer', cursorPos);
        document.body.appendChild(dialog);
    }
    
    createAIDialog(type, cursorPos) {
        const dialog = document.createElement('div');
        dialog.className = 'ai-dialog';
        dialog.innerHTML = `
            <div class="ai-dialog-content">
                <div class="ai-dialog-header">
                    <h3>${type === 'chat' ? 'AI 聊天助手' : 'AI 续写助手'}</h3>
                    <button class="ai-dialog-close">&times;</button>
                </div>
                <div class="ai-dialog-body">
                    ${type === 'chat' ? 
                        '<textarea class="ai-input" placeholder="请输入您的问题..."></textarea>' :
                        '<div class="ai-writer-info">AI 将根据当前文档内容进行续写</div>'
                    }
                    <div class="ai-response"></div>
                </div>
                <div class="ai-dialog-footer">
                    <button class="ai-send">${type === 'chat' ? '发送' : '开始续写'}</button>
                    <button class="ai-cancel">取消</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        dialog.querySelector('.ai-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('.ai-cancel').addEventListener('click', () => {
            dialog.remove();
        });
        
        // Close dialog when clicking on background
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        dialog.querySelector('.ai-send').addEventListener('click', () => {
            if (type === 'chat') {
                this.handleAIChat(dialog, cursorPos);
            } else {
                this.handleAIWriter(dialog, cursorPos);
            }
        });
        
        return dialog;
    }
    
    async handleAIChat(dialog, cursorPos) {
        const input = dialog.querySelector('.ai-input');
        const response = dialog.querySelector('.ai-response');
        const question = input.value.trim();
        
        if (!question) return;
        
        const editor = document.getElementById('editor');
        const content = editor.value;
        
        try {
            response.innerHTML = '<div class="ai-loading">AI 正在思考中...</div>';
            
            let fullResponse = '';
            const resultDiv = document.createElement('div');
            resultDiv.className = 'ai-result';
            resultDiv.innerHTML = `
                <div class="ai-result-text"><span class="ai-typing-cursor">🧱</span></div>
                <div class="ai-result-actions" style="display: none;">
                    <button class="ai-insert">插入到文档</button>
                </div>
            `;
            response.innerHTML = '';
            response.appendChild(resultDiv);
            
            const textDiv = resultDiv.querySelector('.ai-result-text');
            const actionsDiv = resultDiv.querySelector('.ai-result-actions');
            
            await this.callAI({
                role: 'chat',
                content: content,
                question: question
            }, (chunk, fullContent) => {
                fullResponse = fullContent;
                this.typewriterEffect(textDiv, fullContent);
            });
            
            // 移除光标并显示操作按钮
            textDiv.innerHTML = fullResponse;
            actionsDiv.style.display = 'block';
            
            actionsDiv.querySelector('.ai-insert').addEventListener('click', () => {
                this.insertTextAtPosition(editor, cursorPos, '\n\n' + fullResponse);
                dialog.remove();
            });
            
        } catch (error) {
            response.innerHTML = `<div class="ai-error">AI 调用失败: ${error.message}</div>`;
        }
    }
    
    async handleAIWriter(dialog, cursorPos) {
        const response = dialog.querySelector('.ai-response');
        const editor = document.getElementById('editor');
        const content = editor.value;
        
        try {
            response.innerHTML = '<div class="ai-loading">AI 正在续写中...</div>';
            
            let fullResponse = '';
            const resultDiv = document.createElement('div');
            resultDiv.className = 'ai-result';
            resultDiv.innerHTML = `
                <div class="ai-result-text"><span class="ai-typing-cursor">🧱</span></div>
                <div class="ai-result-actions" style="display: none;">
                    <button class="ai-apply">应用到文档</button>
                    <button class="ai-regenerate">重新生成</button>
                </div>
            `;
            response.innerHTML = '';
            response.appendChild(resultDiv);
            
            const textDiv = resultDiv.querySelector('.ai-result-text');
            const actionsDiv = resultDiv.querySelector('.ai-result-actions');
            
            await this.callAI({
                role: 'writer',
                content: content
            }, (chunk, fullContent) => {
                fullResponse = fullContent;
                this.typewriterEffect(textDiv, fullContent);
            });
            
            // 移除光标并显示操作按钮
            textDiv.innerHTML = fullResponse;
            actionsDiv.style.display = 'block';
            
            actionsDiv.querySelector('.ai-apply').addEventListener('click', () => {
                this.insertTextAtPosition(editor, cursorPos, '\n\n' + fullResponse);
                dialog.remove();
            });
            
            actionsDiv.querySelector('.ai-regenerate').addEventListener('click', () => {
                this.handleAIWriter(dialog, cursorPos);
            });
            
        } catch (error) {
            response.innerHTML = `<div class="ai-error">AI 调用失败: ${error.message}</div>`;
        }
    }
    
    async callAI(params, onChunk = null) {
        if (!this.settings.aiApiKey) {
            throw new Error('请先在设置中配置 API Key');
        }
        
        const messages = [];
        
        if (params.role === 'chat') {
            messages.push({
                role: 'system',
                content: '你是一个智能助手，请根据用户提供的文档内容回答问题。请用中文回答。'
            });
            messages.push({
                role: 'user',
                content: `文档内容：\n${params.content}\n\n问题：${params.question}`
            });
        } else if (params.role === 'writer') {
            messages.push({
                role: 'system',
                content: '你是一个智能写作助手，请根据用户提供的文档内容进行续写。续写内容应该与原文风格保持一致，逻辑连贯。请用中文续写。'
            });
            messages.push({
                role: 'user',
                content: `请根据以下内容进行续写：\n${params.content}`
            });
        }
        
        const response = await fetch(`${this.settings.aiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: this.settings.aiModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: onChunk ? true : false
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 调用失败: ${response.status} ${response.statusText}`);
        }
        
        if (onChunk) {
            // 流式处理
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullContent += content;
                                    onChunk(content, fullContent);
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            
            return fullContent;
        } else {
            // 非流式处理
            const data = await response.json();
            return data.choices[0].message.content;
        }
    }
    
    createDefaultTutorial() {
        // 检查公共工作区是否已有教程
        const publicNotes = this.notes.filter(note => note.workspace === 'public');
        const hasTutorial = publicNotes.some(note => note.title.includes('功能教程'));
        
        if (!hasTutorial) {
            const tutorialNote = {
                id: 'tutorial-' + Date.now().toString(),
                title: '📚 智能笔记应用功能教程',
                content: this.getTutorialContent(),
                workspace: 'public',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.notes.unshift(tutorialNote);
            this.saveNotes();
        }
    }
    
    getTutorialContent() {
        return `# 📚 My Markdown功能教程

欢迎使用My Markdown！本教程将帮助您快速掌握所有功能。

## 🚀 基础功能

### 📝 创建和编辑笔记
- 点击左侧边栏的 **"新建笔记"** 按钮创建新笔记
- 在标题栏输入笔记标题
- 在编辑器中输入内容，支持 Markdown 语法
- 应用会自动保存您的更改

### 📁 工作区管理
- **公共工作区**: 存放共享和教程内容
- **私人工作区**: 存放个人私密内容
- 点击工作区选择器切换不同工作区
- 点击 **"+"** 按钮创建新工作区

### 🎨 Markdown 格式化
使用工具栏快速插入 Markdown 元素：

#### 文本格式
- **粗体文本**: \`**粗体**\` 或使用工具栏 **B** 按钮
- *斜体文本*: \`*斜体*\` 或使用工具栏 *I* 按钮
- ~~删除线~~: \`~~删除线~~\`
- \`行内代码\`: 使用反引号包围

#### 标题
\`\`\`
# 一级标题
## 二级标题
### 三级标题
\`\`\`

#### 列表
**无序列表:**
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

**有序列表:**
1. 第一项
2. 第二项
3. 第三项

**任务列表:**
- [x] 已完成任务
- [ ] 待完成任务

#### 引用和代码
> 这是一个引用块
> 可以用来突出重要信息

\`\`\`javascript
// 代码块示例
function hello() {
    console.log("Hello, World!");
}
\`\`\`

#### 表格
| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 保存 | Ctrl+S | 保存当前笔记 |
| 新建 | Ctrl+N | 创建新笔记 |
| 预览 | Ctrl+P | 切换预览模式 |

#### 链接和图片
- 链接: \`[链接文本](URL)\`
- 图片: \`![图片描述](图片URL)\`
- 使用工具栏的图片按钮可以直接插入图片

## 🤖 AI 智能功能

### 启用 AI 功能
1. 点击右上角的 **设置** 按钮
2. 在设置中启用 **"AI 功能"**
3. 配置您的 API Key 和模型设置

### AI 聊天助手
- 在编辑器中输入 \`@chat\` 然后按 **Tab** 键
- 在弹出的对话框中输入问题
- AI 会基于当前文档内容回答您的问题
- 支持流式返回和打字机效果 🧱

### AI 续写助手
- 在编辑器中输入 \`@writer\` 然后按 **Tab** 键
- AI 会根据当前文档内容进行智能续写
- 可以选择应用到文档或重新生成

## 🎨 高级功能

### 🖼️ 图片管理
- 点击工具栏的图片按钮插入图片
- 支持拖拽上传图片文件
- 图片会自动转换为 base64 格式存储
- 在编辑器中可以折叠/展开图片显示

### 🎨 绘图功能
- 点击工具栏的绘图按钮打开绘图板
- 支持多种绘图工具：画笔、橡皮擦、形状等
- 可以调整画笔颜色和粗细
- 绘制完成后可以插入到笔记中

### 📄 模板系统
创建新笔记时可以选择模板：
- **空白笔记**: 从零开始
- **会议记录**: 包含日期、参与者、议程等结构
- **待办清单**: 任务管理模板
- **日记**: 日记记录模板
- **项目计划**: 项目规划模板
- **研究笔记**: 学术研究模板

### 📤 导出功能
支持多种导出格式：
- **PDF**: 生成 PDF 文档
- **HTML**: 导出为网页格式
- **图片**: 将内容导出为图片
- **Markdown**: 导出原始 Markdown 文件

## ⚙️ 个性化设置

### 主题设置
- **浅色主题**: 适合白天使用
- **深色主题**: 适合夜间使用，保护眼睛

### 编辑器设置
- **字体大小**: 可调节编辑器字体大小
- **自动保存**: 开启后会自动保存更改
- **预览模式**: 实时预览 Markdown 渲染效果

### AI 设置
- **API Key**: 配置您的 AI 服务 API 密钥
- **Base URL**: 设置 AI 服务的基础 URL
- **模型选择**: 选择使用的 AI 模型

## 🔧 快捷键

| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 新建笔记 | Ctrl+N | 创建新笔记 |
| 保存笔记 | Ctrl+S | 保存当前笔记 |
| 切换预览 | Ctrl+P | 切换预览模式 |
| 全屏模式 | F11 | 进入/退出全屏 |
| AI 聊天 | @chat + Tab | 触发 AI 聊天 |
| AI 续写 | @writer + Tab | 触发 AI 续写 |

## 💡 使用技巧

1. **快速格式化**: 使用 Markdown 工具栏快速插入格式
2. **图片折叠**: 在编辑器中点击图片旁的按钮可以折叠长图片数据
3. **工作区分类**: 使用不同工作区来组织不同类型的笔记
4. **模板复用**: 创建常用的笔记模板提高效率
5. **AI 辅助**: 利用 AI 功能来辅助写作和问答
6. **实时预览**: 开启预览模式查看最终效果
7. **自动保存**: 开启自动保存避免数据丢失

## 🆘 常见问题

### Q: 如何备份我的笔记？
A: 可以使用导出功能将笔记导出为 Markdown 或其他格式进行备份。

### Q: AI 功能需要网络连接吗？
A: 是的，AI 功能需要连接到配置的 AI 服务提供商。

### Q: 图片存储在哪里？
A: 图片以 base64 格式直接存储在笔记内容中，无需外部存储。

### Q: 可以同时编辑多个笔记吗？
A: 当前版本一次只能编辑一个笔记，但可以快速切换。

### Q: 如何删除笔记？
A: 选择要删除的笔记，点击工具栏的删除按钮。

---

🎉 **恭喜！您已经掌握了智能笔记应用的所有功能。开始创建您的第一个笔记吧！**

> 💡 **提示**: 您可以删除这个教程笔记，或者保留它作为参考。随时可以通过创建新笔记来开始您的笔记之旅。`;
    }
    
    typewriterEffect(element, text) {
        // 显示文本和光标
        element.innerHTML = text + '<span class="ai-typing-cursor">🧱</span>';
    }
    
    insertTextAtPosition(editor, position, text) {
        const currentValue = editor.value;
        const newValue = currentValue.substring(0, position) + text + currentValue.substring(position);
        editor.value = newValue;
        editor.focus();
        editor.setSelectionRange(position + text.length, position + text.length);
        this.onContentChange();
    }
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NotesApp();
});
