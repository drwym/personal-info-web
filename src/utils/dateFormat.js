/**
 * 日期格式化工具函数
 * 统一处理 "YYYY-MM-DD" ↔ "XXXX年XX月XX日" 的转换
 */

/**
 * 将 "YYYY-MM-DD" 格式转为 "XXXX年XX月XX日"
 * @param {string} dateStr - "YYYY-MM-DD" 格式的日期
 * @returns {string} 中文格式日期，无效输入原样返回
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`
  return dateStr
}

/**
 * 将 "XXXX年XX月XX日" 格式转为 "YYYY-MM-DD"
 * @param {string} dateStr - 中文格式日期
 * @returns {string} ISO 格式日期，无效输入原样返回
 */
export const parseDateForInput = (dateStr) => {
  if (!dateStr) return ''
  const m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return dateStr
}

/**
 * 获取今天的日期字符串 "YYYY-MM-DD"
 * @returns {string}
 */
export const todayISO = () => new Date().toISOString().split('T')[0]
