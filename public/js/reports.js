/**
 * ITPE PROJECT - Reports & Gradebook Module
 * Handles:
 * - Topic-level summary reports (Item 6 from whiteboard)
 * - Sorting by Surname (A-Z / Z-A)
 * - Sorting by Score (High to Low / Low to High)
 * - Master summary of ALL quiz scores per student (Item 8 from whiteboard)
 * - Print view with formal academic headers & signatures
 * - PDF export & Spreadsheet (CSV) download
 */

const Reports = {
  state: {
    currentTopicId: null,
    topicSortBy: 'surname', // 'surname' | 'score'
    topicSortOrder: 'asc',
    masterData: null,
    topicData: null
  },

  async renderTopicReport(topicId) {
    this.state.currentTopicId = topicId;
    const main = document.getElementById('main-content');

    try {
      const query = `sort=${this.state.topicSortBy}&order=${this.state.topicSortOrder}`;
      const res = await App.api(`/api/reports/topic/${topicId}?${query}`);
      if (!res.success) return;

      this.state.topicData = res;
      const s = res.subject;
      const t = res.topic;
      const records = res.records || [];
      const generatedAt = new Date();

      let rowsHtml = '';
      records.forEach((r, idx) => {
        const statusClass = r.notTaken ? 'locked' : (r.passed ? 'completed' : 'failed');
        const statusText = r.notTaken ? 'Not Taken' : (r.passed ? `Passed (≥${t.passingPercentage}%)` : `Failed (<${t.passingPercentage}%)`);

        rowsHtml += `
          <tr class="${r.passed ? 'highlight-pass' : (r.notTaken ? '' : 'highlight-fail')}">
            <td>${idx + 1}</td>
            <td><strong>${App.escapeHtml(r.lastName)}</strong>, ${App.escapeHtml(r.firstName)}</td>
            <td><code>${App.escapeHtml(r.idNumber)}</code></td>
            <td><strong>${r.score}</strong> / ${r.totalQuestions}</td>
            <td><strong>${r.percentage}%</strong></td>
            <td><span class="topic-status-badge ${statusClass}">${statusText}</span></td>
            <td>${r.attempts}</td>
            <td>${r.latestSubmittedAt ? new Date(r.latestSubmittedAt).toLocaleDateString() : '—'}</td>
          </tr>
        `;
      });

      main.innerHTML = `
        <div class="report-page report-topic-page">
        <!-- Print Header -->
        <div class="print-header">
          <div class="report-document-brand">ACADEMIC RECORDS <span>•</span> COURSE ASSESSMENT</div>
          <h2>${App.escapeHtml(s.name)} <span>(${App.escapeHtml(s.code)})</span></h2>
          <h3>OFFICIAL TOPIC QUIZ SUMMARY</h3>
          <div class="report-document-meta">
            <span><strong>Term</strong>${App.escapeHtml(s.term || '—')}</span>
            <span><strong>Year level</strong>${App.escapeHtml(s.yearLevel || '—')}</span>
            <span><strong>Topic</strong>${App.escapeHtml(t.title)}</span>
            <span><strong>Generated</strong>${generatedAt.toLocaleString()}</span>
          </div>
          <div class="report-summary-grid">
            <div class="report-summary-item"><strong>${records.length}</strong><span>Registered students</span></div>
            <div class="report-summary-item"><strong>${t.passingPercentage}%</strong><span>Passing standard</span></div>
          </div>
        </div>

        <div class="report-toolbar no-print" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">⬅️ Back to Table of Contents</button>
            <button class="btn btn-outline btn-sm" onclick="App.navigate('topic-detail', '${t.id}')">📖 Open Lesson</button>
          </div>

          <!-- Whiteboard Export Options: Print, PDF, Spreadsheet -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="Reports.printReport()">
              🖨️ Print Report
            </button>
            <button class="btn btn-outline btn-sm" onclick="Reports.exportPdf()">
              📄 Save / Export PDF
            </button>
            <button type="button" onclick="Reports.downloadCsv('/api/reports/topic/${t.id}?sort=${this.state.topicSortBy}&order=${this.state.topicSortOrder}&format=csv', 'topic-${t.order}-gradebook.csv')" class="btn btn-success btn-sm">
              📊 Export Spreadsheet (CSV)
            </button>
          </div>
        </div>

        <div class="card report-content-card">
          <div class="report-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Report Module</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--gray-900);">${App.escapeHtml(t.title)} - Quiz Summary</h2>
              <p style="font-size: 0.85rem; color: var(--gray-600);">
                Passing Criterion: <strong>${t.passingPercentage}%</strong> | Total Registered Students: <strong>${records.length}</strong>
              </p>
            </div>

            <!-- Whiteboard Sorting: Sorted by surname, Sorted by score -->
            <div class="report-sort-controls no-print" style="display: flex; align-items: center; gap: 0.75rem; background: var(--gray-100); padding: 0.5rem 0.75rem; border-radius: var(--radius-md);">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--gray-700);">SORT BY:</span>
              <button class="btn ${this.state.topicSortBy === 'surname' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="Reports.changeTopicSort('surname')">
                🔤 Surname ${this.state.topicSortBy === 'surname' ? (this.state.topicSortOrder === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button class="btn ${this.state.topicSortBy === 'score' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="Reports.changeTopicSort('score')">
                🏆 Score ${this.state.topicSortBy === 'score' ? (this.state.topicSortOrder === 'desc' ? '▼' : '▲') : ''}
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Name (Surname, First)</th>
                  <th>Student ID</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Date Taken</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Print Signatures Section -->
          <div class="print-signatures">
            <div class="print-signature">
              <div class="signature-line"></div>
              <p>Prepared by</p>
              <strong>Faculty / Course Instructor</strong>
            </div>
            <div class="print-signature">
              <div class="signature-line"></div>
              <p>Verified by</p>
              <strong>Department Chair</strong>
            </div>
          </div>
        </div>
        </div>
      `;
    } catch (e) {
      console.error(e);
    }
  },

  changeTopicSort(sortField) {
    if (this.state.topicSortBy === sortField) {
      // Toggle direction
      this.state.topicSortOrder = this.state.topicSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.topicSortBy = sortField;
      this.state.topicSortOrder = sortField === 'score' ? 'desc' : 'asc';
    }
    this.renderTopicReport(this.state.currentTopicId);
  },

  async renderMasterReport() {
    const main = document.getElementById('main-content');

    try {
      const res = await App.api('/api/reports/all');
      if (!res.success) return;

      this.state.masterData = res;
      const s = res.subject;
      const topics = res.topics || [];
      const students = res.students || [];
      const generatedAt = new Date();

      let headerColsHtml = '';
      topics.forEach(t => {
        headerColsHtml += `<th>Topic ${t.order} Score / Attempts</th>`;
      });

      let studentRowsHtml = '';
      students.forEach((stu, idx) => {
        let topicCellsHtml = '';

        topics.forEach(t => {
          const sc = stu.topicScores[t.id];
          if (!sc || sc.notTaken) {
            topicCellsHtml += `<td style="color: var(--gray-400);">—</td>`;
          } else {
            const badgeClass = sc.passed ? 'color: #166534; font-weight: 700;' : 'color: #991b1b; font-weight: 700;';
            topicCellsHtml += `
              <td style="${badgeClass}">
                ${sc.score}/${sc.total} (${sc.percentage}%)<br><small>${sc.attempts} attempt${sc.attempts === 1 ? '' : 's'}</small>
              </td>
            `;
          }
        });

        const statusClass = stu.overallStatus === 'PASSED' ? 'completed' : (stu.overallStatus === 'IN PROGRESS' ? 'in-progress' : 'failed');

        studentRowsHtml += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${App.escapeHtml(stu.lastName)}</strong>, ${App.escapeHtml(stu.firstName)}</td>
            <td><code>${App.escapeHtml(stu.idNumber)}</code></td>
            ${topicCellsHtml}
            <td>${stu.quizAttempts || 0}</td>
            <td><strong>${stu.totalEarned}</strong> / ${stu.totalPossible}</td>
            <td><strong>${stu.overallPercentage}%</strong></td>
            <td><span class="topic-status-badge ${statusClass}">${stu.overallStatus}</span></td>
          </tr>
        `;
      });

      main.innerHTML = `
        <div class="report-page report-master-page">
        <div class="print-header">
          <div class="report-document-brand">ACADEMIC RECORDS <span>•</span> COURSE ASSESSMENT</div>
          <h2>${App.escapeHtml(s.name)} <span>(${App.escapeHtml(s.code)})</span></h2>
          <h3>MASTER SUMMARY OF QUIZ SCORES PER STUDENT</h3>
          <div class="report-document-meta">
            <span><strong>Term</strong>${App.escapeHtml(s.term || '—')}</span>
            <span><strong>Year level</strong>${App.escapeHtml(s.yearLevel || '—')}</span>
            <span><strong>Generated</strong>${generatedAt.toLocaleString()}</span>
          </div>
          <div class="report-summary-grid">
            <div class="report-summary-item"><strong>${students.length}</strong><span>Total students</span></div>
            <div class="report-summary-item"><strong>${topics.length}</strong><span>Course topics</span></div>
            <div class="report-summary-item"><strong>${res.passingPercentage || 50}%</strong><span>Passing standard</span></div>
          </div>
        </div>

        <div class="report-toolbar no-print" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">⬅️ Back to Table of Contents</button>

          <!-- Whiteboard Requirement #8: Print, PDF, Spreadsheet -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="Reports.printReport()">
              🖨️ Print
            </button>
            <button class="btn btn-outline btn-sm" onclick="Reports.exportPdf()">
              📄 PDF
            </button>
            <button type="button" onclick="Reports.downloadCsv('/api/reports/all?format=csv', 'master-gradebook.csv')" class="btn btn-success btn-sm">
              📊 Spreadsheet (CSV)
            </button>
          </div>
        </div>

        <div class="card report-content-card">
          <div class="report-card-header" style="border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Institutional Class Record</span>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--gray-900);">
                Master Summary of ALL Quiz Scores per Student
              </h2>
              <p style="font-size: 0.85rem; color: var(--gray-600);">
                Consolidated matrix across all modules (1 to ${topics.length}). Alphabetically arranged by student surname.
              </p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Surname, First Name</th>
                  <th>Student ID</th>
                  ${headerColsHtml}
                  <th>Quiz Attempts</th>
                  <th>Total Score</th>
                  <th>Overall %</th>
                  <th>Standing</th>
                </tr>
              </thead>
              <tbody>
                ${studentRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Print Signatures Section -->
          <div class="print-signatures">
            <div class="print-signature">
              <div class="signature-line"></div>
              <strong>Faculty / Course Instructor</strong>
            </div>
            <div class="print-signature">
              <div class="signature-line"></div>
              <strong>College Dean / Department Chair</strong>
            </div>
          </div>
        </div>
        </div>
      `;
    } catch (e) {
      console.error(e);
    }
  },

  printReport() {
    window.print();
  },

  async downloadCsv(url, filename) {
    try {
      const response = await fetch(url, {
        headers: App.state.token ? { Authorization: `Bearer ${App.state.token}` } : {}
      });
      if (!response.ok) throw new Error('Could not download the gradebook. Please log in again.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      App.toast(error.message || 'CSV download failed.', 'danger');
    }
  },

  exportPdf() {
    App.toast('Tip: Select "Save as PDF" in the destination dropdown to download the PDF.', 'info');
    setTimeout(() => {
      window.print();
    }, 400);
  }
};

window.Reports = Reports;
