function NotFoundPage() {
  return (
    <>
      <div className="breadcrumb">
        <span>PRZESTRZEŃ</span>
        <span className="breadcrumb-slash">/</span>
        <span>404</span>
      </div>

      <div className="empty-state">
        <p className="eyebrow">NIE ZNALEZIONO</p>
        <h1>Tej strony nie ma</h1>
        <p className="project-description">
          Adres jest nieznany albo projekt, do którego prowadził, został usunięty.
        </p>
      </div>
    </>
  )
}

export default NotFoundPage
