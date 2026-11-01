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
        <!-- Print Header -->
        <div class="print-header">
          <h2>${App.escapeHtml(s.name)} (${App.escapeHtml(s.code)})</h2>
          <h3>OFFICIAL TOPIC QUIZ SUMMARY REPORT</h3>
          <p>${App.escapeHtml(s.term)} | ${App.escapeHtml(s.yearLevel)}</p>
          <p><strong>Topic:</strong> ${App.escapeHtml(t.title)} | <strong>Passing Score:</strong> ${t.passingPercentage}%</p>
          <p><small>Generated on: ${new Date().toLocaleString()}</small></p>
        </div>

        <div class="no-print" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="App.goBack('topics')">Back to modules</button>
            <button class="btn btn-outline btn-sm" onclick="App.navigate('topic-detail', '${t.id}')"> Open Lesson</button>
          </div>

          <!-- Whiteboard Export Options: Print, PDF, Spreadsheet -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="Reports.printReport()">
               Print Report
            </button>
            <button class="btn btn-outline btn-sm" onclick="Reports.exportPdf()">
               Save / Export PDF
            </button>
            <button type="button" onclick="Reports.downloadCsv('/api/reports/topic/${t.id}?sort=${this.state.topicSortBy}&order=${this.state.topicSortOrder}&format=csv', 'topic-${t.order}-gradebook.csv')" class="btn btn-success btn-sm">
               Export Spreadsheet (CSV)
            </button>
          </div>
        </div>

        <div class="card">
          <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Report Module</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #f0f2ff;">${App.escapeHtml(t.title)} - Quiz Summary</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary, #94a3b8);">
                Passing Criterion: <strong>${t.passingPercentage}%</strong> | Total Registered Students: <strong>${records.length}</strong>
              </p>
            </div>

            <!-- Whiteboard Sorting: Sorted by surname, Sorted by score -->
            <div style="display: flex; align-items: center; gap: 0.75rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); padding: 0.5rem 0.75rem; border-radius: var(--radius-md, 8px);">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary, #94a3b8);">SORT BY:</span>
              <button class="btn ${this.state.topicSortBy === 'surname' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="Reports.changeTopicSort('surname')">
                 Surname ${this.state.topicSortBy === 'surname' ? (this.state.topicSortOrder === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button class="btn ${this.state.topicSortBy === 'score' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="Reports.changeTopicSort('score')">
                 Score ${this.state.topicSortBy === 'score' ? (this.state.topicSortOrder === 'desc' ? '▼' : '▲') : ''}
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
            <div style="text-align: center; width: 200px;">
              <div style="border-bottom: 1px solid #000; height: 35px;"></div>
              <p style="font-weight: 700; font-size: 9pt; margin-top: 4px;">Prepared by: Instructor</p>
            </div>
            <div style="text-align: center; width: 200px;">
              <div style="border-bottom: 1px solid #000; height: 35px;"></div>
              <p style="font-weight: 700; font-size: 9pt; margin-top: 4px;">Verified by: Department Chair</p>
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
            topicCellsHtml += `<td style="color: var(--text-muted, #64748b);">—</td>`;
          } else {
            const badgeClass = sc.passed ? 'color: #34d399; font-weight: 700;' : 'color: #f87171; font-weight: 700;';
            topicCellsHtml += `
              <td style="${badgeClass}">
                ${sc.score}/${sc.total} (${sc.percentage}%)<br><small>${sc.attempts} attempt${sc.attempts === 1 ? '' : 's'}</small>
              </td>
            `;
          }
        });

        const statusClass = stu.overallStatus === 'PASSED' ? 'completed' : (stu.overallStatus === 'IN PROGRESS' ? 'in-progress' : (stu.overallStatus === 'NOT STARTED' ? 'not-started' : 'failed'));

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
        <!-- Print Header -->
        <div class="print-header">
          <h2>${App.escapeHtml(s.name)} (${App.escapeHtml(s.code)})</h2>
          <h3>MASTER SUMMARY OF ALL QUIZ SCORES PER STUDENT</h3>
          <p>${App.escapeHtml(s.term)} | ${App.escapeHtml(s.yearLevel)}</p>
          <p><strong>Total Course Topics:</strong> ${topics.length} | <strong>Passing Standard:</strong> ${res.passingPercentage || 50}% per module</p>
          <p><small>Official Record Generated on: ${new Date().toLocaleString()}</small></p>
        </div>

        <div class="report-toolbar no-print">
          <div><span class="report-eyebrow">ACADEMIC RECORDS</span><h1>Gradebook</h1><p>Student progress and assessment results across the course.</p></div>
          <!-- Whiteboard Requirement #8: Print, PDF, Spreadsheet -->
          <div class="report-actions">
            <button class="btn btn-secondary btn-sm" onclick="App.goBack('topics')">Back</button>
            <button class="btn btn-primary btn-sm" onclick="Reports.printReport()">
               Print
            </button>
            <button class="btn btn-outline btn-sm" onclick="Reports.exportPdf()">
               PDF
            </button>
            <button type="button" onclick="Reports.downloadCsv('/api/reports/all?format=csv', 'master-gradebook.csv')" class="btn btn-success btn-sm">
               Spreadsheet (CSV)
            </button>
          </div>
        </div>

        <section class="report-stat-grid no-print" aria-label="Gradebook summary">
          <article class="report-stat-card"><span>Enrolled students</span><strong>${students.length}</strong><small>Registered learner accounts</small></article>
          <article class="report-stat-card"><span>Course modules</span><strong>${topics.length}</strong><small>Published learning topics</small></article>
          <article class="report-stat-card"><span>Passing standard</span><strong>${res.passingPercentage || 50}%</strong><small>Required per module</small></article>
        </section>

        <div class="card gradebook-card">
          <div class="no-print" style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Institutional Class Record</span>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: #f0f2ff;">
                Master Summary of ALL Quiz Scores per Student
              </h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary, #94a3b8);">
                All enrolled students, listed alphabetically by surname.
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
              <tbody>${students.length ? studentRowsHtml : `<tr><td class="gradebook-empty" colspan="${7 + topics.length}"><strong>No students enrolled yet</strong><span>Student accounts will appear here automatically after registration.</span></td></tr>`}</tbody>
            </table>
          </div>

          <!-- Print Signatures Section -->
          <div class="print-signatures">
            <div style="text-align: center; width: 220px;">
              <div style="border-bottom: 1px solid #000; height: 40px;"></div>
              <p style="font-weight: 700; font-size: 9pt; margin-top: 5px;">Faculty / Course Instructor</p>
            </div>
            <div style="text-align: center; width: 220px;">
              <div style="border-bottom: 1px solid #000; height: 40px;"></div>
              <p style="font-weight: 700; font-size: 9pt; margin-top: 5px;">College Dean / Department Chair</p>
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

