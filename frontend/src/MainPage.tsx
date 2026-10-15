function MainPage() {
  return (
    <>
      <div className="breadcrumb">
        <span>PRZESTRZEŃ</span>
        <span className="breadcrumb-slash">/</span>
        <span>START</span>
      </div>

      <div className="project-heading">
        <div>
          <p className="project-kicker">STRONA GŁÓWNA</p>
          <h1>Start</h1>
        </div>
      </div>

      <section className="project-card" aria-label="Strona główna">
        <div className="card-edge" aria-hidden="true" />
        <div className="card-topline">
          <span>W BUDOWIE</span>
          <span className="card-mark" aria-hidden="true">✳</span>
        </div>
        <p className="project-description">
          Ta strona czeka na przyszłe podsumowania Twojej pracy.
        </p>
        <div className="card-bottomline">
          <span className="status-light" aria-hidden="true" />
          <span>WKRÓTCE</span>
        </div>
      </section>
    </>
  )
}

export default MainPage
