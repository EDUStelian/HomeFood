import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)

  const [scanning, setScanning] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProducts()

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
    }
  }, [])

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products`)

      if (!response.ok) {
        throw new Error('Could not load products')
      }

      const data = await response.json()
      setProducts(data)
      setError('')
    } catch (err) {
      console.error('Database loading error:', err)
      setError(
        'Could not connect to the HomeFood database.'
      )
    }
  }

  function stopScanner() {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setScanning(false)
  }

  async function startScanner() {
    setBarcode('')
    setProduct(null)
    setError('')
    setScanning(true)

    try {
      const reader = new BrowserMultiFormatReader()

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText()

            console.log('Barcode detected:', code)

            setBarcode(code)

            if (controlsRef.current) {
              controlsRef.current.stop()
              controlsRef.current = null
            }

            if (videoRef.current) {
              videoRef.current.srcObject = null
            }

            setScanning(false)

            findProduct(code)
          }
        }
      )

      controlsRef.current = controls
    } catch (err) {
      console.error('Scanner error:', err)
      setError('Could not access the camera.')
      setScanning(false)
    }
  }

  async function findProduct(code) {
    setLoading(true)
    setError('')
    setProduct(null)

    try {
      const url =
        'https://world.openfoodfacts.org/api/v2/product/' +
        code +
        '?fields=product_name,brands,quantity,image_front_url,categories'

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Open Food Facts request failed')
      }

      const data = await response.json()

      if (data.status === 1 && data.product) {
        setProduct({
          ...data.product,
          barcode: code,
        })
      } else {
        setError(
          'Product was not found in Open Food Facts.'
        )
      }
    } catch (err) {
      console.error('Open Food Facts error:', err)

      setError(
        'Could not connect to Open Food Facts.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function addProduct() {
    if (!product || saving) {
      return
    }

    setSaving(true)
    setError('')

    const newProduct = {
      barcode: product.barcode,
      name: product.product_name || 'Unknown product',
      brand: product.brands || '',
      quantity: product.quantity || '',
      image: product.image_front_url || '',
      category: product.categories || '',
    }

    try {
      console.log(
        'Sending product to database:',
        newProduct
      )

      const response = await fetch(
        `${API_URL}/products`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newProduct),
        }
      )

      const data = await response.json()

      console.log(
        'Database response:',
        data
      )

      if (!response.ok) {
        throw new Error(
          data.detail || 'Database returned an error.'
        )
      }

      if (!data.success) {
        setError(
          data.message ||
            'Product could not be added.'
        )
        return
      }

      await loadProducts()

      setProduct(null)
      setBarcode('')
    } catch (err) {
      console.error(
        'Could not save product:',
        err
      )

      setError(
        `Could not save product: ${err.message}`
      )
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct(id) {
    try {
      const response = await fetch(
        `${API_URL}/products/${id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Could not delete product.'
        )
      }

      await loadProducts()
    } catch (err) {
      console.error(
        'Could not delete product:',
        err
      )

      setError(
        `Could not delete product: ${err.message}`
      )
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🏠 HomeFood</h1>
        <p>What's in my house?</p>
      </header>

      <main className="main">
        <section className="scanner-section">
          <h2>Scan a product</h2>

          <div className="scanner">
            <video
              ref={videoRef}
              className="video"
              autoPlay
              muted
              playsInline
            />
          </div>

          <div className="buttons">
            {!scanning ? (
              <button
                onClick={startScanner}
                className="primary-button"
              >
                📷 Start Scanner
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="secondary-button"
              >
                ⏹ Stop Scanner
              </button>
            )}
          </div>

          {scanning && (
            <p className="status">
              Point the camera at a barcode...
            </p>
          )}

          {barcode && (
            <p className="barcode">
              Barcode: <strong>{barcode}</strong>
            </p>
          )}

          {loading && (
            <p className="status">
              🔎 Looking up product...
            </p>
          )}

          {error && (
            <div className="error">
              {error}
            </div>
          )}
        </section>

        {product && (
          <section className="product-section">
            <h2>Product found</h2>

            <div className="product-card">
              {product.image_front_url && (
                <img
                  src={product.image_front_url}
                  alt={product.product_name || 'Product'}
                  className="product-image"
                />
              )}

              <div className="product-info">
                <h3>
                  {product.product_name ||
                    'Unknown product'}
                </h3>

                {product.brands && (
                  <p>
                    <strong>Brand:</strong>{' '}
                    {product.brands}
                  </p>
                )}

                {product.quantity && (
                  <p>
                    <strong>Quantity:</strong>{' '}
                    {product.quantity}
                  </p>
                )}

                {product.categories && (
                  <p>
                    <strong>Category:</strong>{' '}
                    {product.categories}
                  </p>
                )}

                <p>
                  <strong>Barcode:</strong>{' '}
                  {product.barcode}
                </p>

                <button
                  onClick={addProduct}
                  disabled={saving}
                  className="primary-button"
                >
                  {saving
                    ? '💾 Saving...'
                    : '➕ Add to My Ingredients'}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="ingredients-section">
          <h2>
            🧺 My Ingredients ({products.length})
          </h2>

          {products.length === 0 ? (
            <p className="empty">
              No ingredients added yet.
            </p>
          ) : (
            <div className="products-list">
              {products.map((item) => (
                <div
                  className="ingredient-card"
                  key={item.id}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="ingredient-image"
                    />
                  ) : (
                    <div className="ingredient-placeholder">
                      🥫
                    </div>
                  )}

                  <div className="ingredient-info">
                    <h3>{item.name}</h3>

                    {item.brand && (
                      <p>{item.brand}</p>
                    )}

                    {item.quantity && (
                      <p>{item.quantity}</p>
                    )}

                    <small>
                      Barcode: {item.barcode}
                    </small>
                  </div>

                  <button
                    onClick={() =>
                      removeProduct(item.id)
                    }
                    className="delete-button"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App