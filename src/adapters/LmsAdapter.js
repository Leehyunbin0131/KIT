class LmsAdapter {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.crawlWin = null; // Background browser window for crawling
    this.onProgress = null; // Progress callback
  }

  /**
   * Set the background crawling window managed by the system.
   * @param {BrowserWindow} crawlWin 
   */
  setCrawlWindow(crawlWin) {
    this.crawlWin = crawlWin;
  }

  /**
   * Set progress reporting callback.
   * @param {Function} cb - (message: string) => void
   */
  setProgressCallback(cb) {
    this.onProgress = cb;
  }

  /**
   * Helper function to log progress.
   */
  logProgress(msg) {
    if (this.onProgress) this.onProgress(msg);
  }

  /**
   * Login logic using provided credentials.
   * Overridden by subclass.
   * @param {Object} credentials { id, pw }
   * @returns {Promise<boolean>}
   */
  async login(credentials) {
    throw new Error('Not implemented');
  }

  /**
   * Crawl main dashboard to extract user info, subjects, timetable.
   * Overridden by subclass.
   * @returns {Promise<Object>} { userInfo, courses, timetable }
   */
  async crawlMainPage() {
    throw new Error('Not implemented');
  }

  /**
   * Extract sub-details for a specific course (e.g. 9 tabs).
   * Overridden by subclass.
   * @param {Object} course The course object from crawlMainPage
   * @param {number} index Current course index
   * @param {number} total Total courses
   * @returns {Promise<Object>} course details containing notice, plan, etc.
   */
  async crawlCourseDetail(course, index, total) {
    throw new Error('Not implemented');
  }

  /**
   * Fetch specific board post detail content HTML.
   * Overridden by subclass.
   * @param {string} url Post relative URL
   * @param {string} courseKey Identifier for the course
   * @returns {Promise<string>} Detailed HTML
   */
  async fetchDetailContent(url, courseKey) {
    throw new Error('Not implemented');
  }
}

module.exports = LmsAdapter;
